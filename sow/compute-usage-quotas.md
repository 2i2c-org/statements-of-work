# Usage Quotas on JupyterHub

## Problem statement

Since cloud compute pricing is elastic, cloud compute usage directly correlates to cost - the higher any particular user's usage, the higher the cloud cost. This is great because if you use very little, you don't pay much. This is terrible because if you use a lot, you pay a lot! JupyterHub admins need control over how much any individual user can cost them.

This can be done by providing JupyterHub admins control over how much compute any individual user can use over time.

## Definition of Done (Overall, not just for initial SOW / phase 1)

When fully implemented, the solution would have the following components:

1. **Groups** to which users can belong
2. A way **for admins** to easily determine which users belong to which groups
3. **Compute Quotas**, with a unit of Resource \* Time (So CPUHours, MemoryHours and GPUHours)
4. A way **for admins** to associate particular groups with a particular compute quota
5. A way **for admins** to see a overall report of users and their quota usage
6. A way to enforce these quotas, so users can not use more than that
7. A way **for users** to be aware of their existing quota usage, and modify their behavior accordingly

Let's break down what the workflow would look like.

## Example administrator workflow

An administrator has decided through internal control mechanisms that users would need to be split into four groups:

1. regular
2. power
3. dev
4. gpu-dev

They can easily segment users in whatever _authentication_ system they have into these groups (for example, via GitHub teams or auth0 groups/roles). Further, they have a way to specify the following quotas for each group:

| Group   | MemoryHours (in GiB \* Hr) | GPUHours (in GPU count \* Hr) |
| ------- | -------------------------- | ----------------------------- |
| regular | 60                         | 0                             |
| power   | 240                        | 0                             |
| dev     | 640                        | 0                             |
| gpu-dev | 640                        | 160                           |

They can adjust these quotas as they wish over time. There is also an interface that allows them to see how users are currently using up their various quotas.

## Example user workflow

The user logs into the JupyterHub, and they launch a server with 4GB of RAM to use for some work. They keep it running for about 4 hours, are done with their work, and leave. They don't shut it down manually, but the idle culler reclaims it after 60min of idle time. This counts as 20 GiBHour (4GiB \* 5Hr) in their quota.

They are able to take a look at their quota usage through a web interface, and notice they have already used 50 of their 60 GiBHour for this month. They recognize they need more, so they reach out to an admin to ask for more quota. After recognizing this need, the admin moves them to the `power` user group (from `regular`), and they now have 240 GiB Hour for this month.

When the user goes over their quota, their existing servers are shut down and new servers unable to be started. They can either contact their admin for more quota, or wait out until their quota refills (a rolling 30d period by default).

## Out of scope

- We are intentionally focusing on _usage_ quotas, rather than _cloud cost quotas_. Compute cycles are directly corelated to cloud costs, but do not account for all of them. For example, if a user uploads a few hundred terabytes of data from their hub to an external source (does not happen in practice), that would add to cloud cost. What we are doing here is adding _guardrails_ that prevent good faith users from unintentionally jacking up cloud costs. Preventing _abuse_ should be handled separately. See our unpublished blog post about cloud cost control (https://hackmd.io/AqZxyS8oSyGCpWfyX3_pfA). **JupyterHub Admins** must interact internally with their own budgets and make choices here - ultimately they need to keep an eye on cloud costs and manage them. This simply adds another important tool to their toolkit.
- For some cases, administrators may desire for the quota to be set for _a group as a whole_, rather than for individuals in a group. For example, 'research group A has 5000 GiBHours, regardless of which users consume it'. This system can be extended to provide this functionality, but it's out of scope for the first iteration since doing this 'fairly' requires more thought and implementation effort.

## Questions to be answered

- A user can belong to multiple groups. How is this represented when each group can have different quotas associated with them?
  - For this round of implementation, we simply take the _max_ of their quotas.
- User personas we care about
  - (Robert Weekly) Researchers are who we care about. They are most likely to blow up our costs. People in Workshops 'follow the instructor'. Cost concern.

## Phases

We split the overall work into multiple phases that build on each other, and provide value to communities at the end of each phase. Doing so allows us to make progress without striving for perfection, and makes each piece of work more manageable. Each phase should:

1. Take into account future desired phases so we don't end up making architectural, technical or social choices that lead us down a dead end.
2. Be detailed enough to be roughly estimatable
3. Provide value to end users upon completion

This document primarily works on Phase 1.

## Phase 1

Phase 1 is foundational, and sets up the baseline work needed for unified quota management throughout.

### Definition of Done

- [ ] Individual users get a certain amount of Memory and CPU quota based on the groups they are members of
- [ ] Quotas are enforced _only_ for JupyterHub, and only at server launch time
- [ ] Mapping of Groups to Quotas is handled via PRs to 2i2c-org/infrastructure repository or opening a support ticket.
- [ ] Users can see how much quota they have used, and how much they have left
- [ ] Clear error message is presented to users when they are out of quota, with directions for asking for more (that do not involve 2i2c)

### Intentionally out of scope for this phase

These are pieces that are intentionally out of scope for this phase, but expected to be supported in a future phase. Since phase 1 is foundational, care will be taken to make sure we don't accidentally design ourselves into a corner that prevents us from acheiving the following in the future.

- Dask support
- GPU support
- Storage (home directories and object storage) support
- Stopping running servers when users go over quota
- Self-serve UI for administrators to set quotas
- Reporting on quota usage (in Grafana) for administrative use
- Detailed reporting on quota usage for users
- "Shared project" quotas, where admins can set 'X quota shared between all users of a particular group / project, regardless of which specific user uses them'

## Components

1. **Source of truth about usage**. A data store that can be _reliably_ counted upon to have accurate information on how much any user has used any supported resource over a particular period of time.
2. A source of truth for **quota configuration**. Something that describes _rules_ for deciding what users have access to how much resources over time.
3. Logic to check 'is the user allowed to do this?', where 'this' is 'start a new server' or 'keep this server running'. This is the mechanism that applies the _policy_ described in (2) to the data available from (1).
4. Hooks in JupyterHub that reach out to (3) during server start, and if the user isn't allowed, provide a useful error message
5. Same as (4) but for dask
6. Same as (4), but on an ongoing basis so that users running servers are killed when they reach over quota
7. A simple way for users to know what quota they have, and how much is left.

Note: Components 5 and 6 are not under consideration for Phase 1.

## Phase 1: Design considerations

### What should source of usage truth be? (component 1)

The obvious answer is prometheus. But right now, prometheus is not part of the _critical path_ of anything - if prometheus is down, users don't actually see any issues. We can also wipe prometheus data and not see problems anywhere other than in reporting. Since prometheus as we have it deployed is pretty big, we should _not_ put that in the critical path.

Our two options here are:

1. Run a _different_ prometheus instance that _only_ collects an allow-listed set of metrics that we desire
2. Write our own collector that keeps state in a database.

Does this data source need to be HA? It needs to be as available as the hub.

### How should quota rules be represented? (component 2)

To start with, we only want a mapping of group name -> quota for a resource. This can be in two places:

1. YAML config in a repository
2. a GUI where admins can set things up

We can start with (1) and progress to (2) as desired.

### Where should logic for checking quotas live? (component 3)

Since this has to be used from multiple different components, there are two ways to do this:

1. A service architecture, where we implement a single service that other components (like hub, dask gateway, etc) can talk to _over HTTP_ to get their answers
2. A library-component architecture, where we implement a python package that can talk to (2) and (1) to figure out the answer. This will be in turn used by (4), (5), (6) and (7) as a _library_.

Both have pros and cons, and the answer to this probably also depends on (2).

### Hooks in JupyterHub that reach out to (3) during server start, and if the user isn't allowed, provide a useful error message (component 4)

This needs to happen before the kubespawner kicks in and asks for resources. Pre-spawn hooks are available:

- [kubespawner](https://jupyterhub-kubespawner.readthedocs.io/en/latest/spawner.html#kubespawner.KubeSpawner.pre_spawn_hook)
- [JupyterHub spawner](https://jupyterhub.readthedocs.io/en/stable/reference/api/spawner.html#jupyterhub.spawner.Spawner.pre_spawn_hook)

### How can users know what quota they have and how much is left? (component 7)

This should be made available as a JupyterHub service providing a web page that users can check. It should only show them their own quota information. This may also be available via an API that gets integrated into JupyterLab in the future.

## Summary of discussion between Yuvi & Jenny

1. Use a separate tuned prometheus as _source of usage data_.
2. Keep _mapping of quota to groups_ as YAML
3. Build an _async python library_ that can make quota decisions, with an eye to eventually turning this into a service if necessary.
4. Find or build hooks in JupyterHub to be able to check quota before a spawn and provide a message to user if needed.
5. Build a JupyterHub service that lets users check their allowed quota and existing usage.

## Phase 1: Deliverables

### Deliverable 1. Setup a prometheus specifically for quota system use

#### Overview

[Prometheus](https://prometheus.io/) is a time series database that we will be using as our 'source of truth' for answering 'how much has a user X used resource Y in the last Z time period'. Prometheus uses [exporters](https://prometheus.io/docs/instrumenting/exporters/) to 'pull' this information. The first deliverable is making sure we are reliably collecting _all_ the data we need to enforce quotas, leveraging existing software wherever possible.

#### Definition of done

- [ ] Metrics needed to clearly answer 'how much has a user X used resource Y in the last Z time period' for memory and cpu resources are identified
- [ ] Exporters needed to produce the metrics needed are identified
- [ ] If additional configuration or new exporters are needed to answer this question, those are either configured or exporters are built.
- [ ] Prometheus server set up with relevant exporters on a _per hub_ basis, and collecting metrics
- [ ] Appropriate retention configuration is set up
- [ ] Monitoring and alerting to make sure this prometheus server is reliable
- [ ] Authentication is set up so only components that need access to the prometheus server can access it.
- [ ] This whole set up is rolled out to the _earthscope staging hub_.

#### Estimates (56-68h)

App Eng: 12-24h
Infra Eng: ~32h
Co-ordination overhead: ~12h

#### Risk factors

1. Metric for mapping users to resource usage does not exist and needs JupyterHub or custom exporter work
   - Mitigation: Quick check shows JupyterHub already sets correct annotations. Requires Infra Eng work to pick that up in prometheus only, no app eng work needed.

#### People needed

1. App Eng to decide what metrics are needed, and build additional exporters if necessary
2. Infra Eng to set up the exporters and prometheus in an production ready way

#### Notes

This prometheus server is now on the critical path to server startup, unlike the prometheus server we already run (which is only used for reporting). We need to make a choice on fallback in case this prometheus server is down - either fallback to allowing everyone, or blocking everyone (Yuvi's preferred approach). We can make this choice on a per-hub basis.

#### Demo reels

1. Prometheus with all metrics we care about running in production (GIF)

### Deliverable 2. Build a python library to make quota decisions

#### Overview

The core of the quotaing system consists of:

1. A way to declaritively specify _quotas_, consisting of:
   - A _resource_ (lime RAM or CPU)
   - A _rolling time duration_ (last 30 days)
   - A _limit_ expressed in terms of a _Resource \* Time_ (GiBHours or CPUHours)
2. Based on this configuration, a way to ask 'this user wants to use X units of resource Y. Are they allowed to do it?'

We will implement a _async friendly python library_ that can answer this question. It'll take the following inputs:

1. Quota configuration (as YAML / Traitlets)
2. Access to a prometheus server (Deliverable 1)
3. The name of the user
4. The list of groups the user is part of
5. What resources (RAM / CPU) they are requesting

And provide as output:

1. A yes/no on wether they are allowed to access this response

To do this, it would need to:

1. Figure out exactly what quotas apply to this particular user, based on the groups they belong to and the quota configuration
2. Reach out to the prometheus server to figure out their usage
3. Perform logical checks to figure out if they have quota left or not

#### Definition of Done

- [ ] Schema for _defining_ quota configuration is specified
- [ ] When run outside JupyterHub spawn context, this library can talk to JupyterHub API to figure out groups a user is in
- [ ] A python library is written to production standards
  - [ ] Appropriate tests
  - [ ] Fully typechecked
  - [ ] Usage Documentation
  - [ ] Contributor documentation, including local setup of Prometheus & exporters
- [ ] Library is published to PyPI

#### Estimates

```{estimate-table}
- - PromQL exploration
  - 4h
  - 4h
- - Quota schema definition
  - 10h
  - 10h
- - JupyterHub API integration
  - 4h
  - 4h
- - Core quota logic
  - 24h
  - 32h
- - Integration testing infrastructure + setup
  - 24h
  - 32h
- - Documentation
  - 12h
  - 24h
- - Package publishing
  - 4h
  - 4h
```

#### Notes

1. This library should not be tied to any specific kubernetes concepts. That allows it to be used in the future outside either JupyterHub or kubernetes as needed, drastically improving chances of it being accepted upstream.
2. By writing it in async python from the start, we can use it in-line in all the places we need (JupyterHub hooks, dask-gateway, etc). It can also be turned into a network based service if needed.
3. This is security sensitive code and should be treated as such.
4. The quota configuration schema should also be usable to provide more direct information about quota _usage_ for Deliverable 3

#### Risk factors

This library provides critical functionality to enable usage quotas. If this piece does not work then we have to rethink our entire technical approach. Ways this could not work:

1. Prometheus data is not reliable enough to make quota logic decisions -> rethink deliverable 1
2. Quota decisions cannot be made in real-time, so there will be potential overages we need to explain
3. There is a certain amount of exploratory work here that could snowball effort estimates

#### People needed

1. App engineers to build the library

#### Demo Reel

1. Commandline example showing whether a user's quota request for a particular size server would be allowed or not (GIF?)

### Deliverable 3: JupyterHub service for users to check their own quota

#### Overview

End users need a way to:

1. Know what quota limitations they are subject to
2. How much of their quota they have used so far

We will build a web application that is a [JupyterHub service](https://jupyterhub.readthedocs.io/en/latest/reference/services.html) for users to check this for themselves.

##### Intentionally out of Scope

For this deliverable, we are leaving the following as intentionally out of scope:

1. Visualizations of usage over time. Users will only get numbers, no charts or graphs.
2. No integration with JupyterLab, this would be a separate web page users would need to go to.
3. No integration with _storage quotas_ for now, only CPU / Memory.

All these are possible features to be added in future phases, so our design needs to accomodate them.

#### Definition of Done

- [ ] A UI mockup of how this looks for the end user is made
- [ ] A JupyterHub Service is deployed to the _earthscope staging hub_, providing users with a link where they can go check their own quota
- [ ] Documentation on how this service can be deployed anywhere
- [ ] Contributor documentation on how to contribute to this service, including local set up.
- [ ] The service is packaged as a python package and published to PyPi.

#### Estimates

```{estimate-table}
- - Setting up the base JupyterHub service with auth
  - 12h
  - 12h
- - Setting up the base frontend with dependencies & packaging
  - 12h
  - 12h
- - Design and mockup of UI
  - 10h
  - 10h
- - Build backend application
  - 24h
  - 32h
- - Build frontend application
  - 24h
  - 32h
- - Documentation
  - 8h
  - 8h
- - Package publishing
  - 4h
  - 4h
```

#### People needed

- App Eng for building the service
- Infrastructure Eng for deploying the service

#### Notes

1. This should be exactly as generic as the library in deliverable 2. Could possibly specify warnings if user is close to their quota.
2. Should have decent explanations for users to understand how the quota is calculated
3. Should re-use as much code as possible from deliverable 2.
4. Users should be only able to see their own quota and usage - this is a _security_ boundary.
5. This is going to be a python backend (tornado) providing an API to be consumed by a JS frontend

#### Demo reel

1. Earthscope staging hub link where users can see how much quota they have used (real live demo)

### Deliverable 4: Improve the 'Spawn Progress' page on JupyterHub

#### Overview

When a user attempts to start a JupyterHub server after making a profile selection, they are shown a 'progress' page that shows them status messages about how the spawn is going. In quota enabled systems, this is a great place in the UX for two things:

1. If they have enough quota, to show how much quota they have used.
2. If they don't have enough quota, clearly show them a user friendly error message that tells them where to go next.

The current UX of this page is such that most users are observed to ignore it, primarily due to the following problems:

1. The progress messages shown are directly from the underlying system (Kubernetes), and make no sense to most users. Do you know what `2025-03-19T00:51:47.961011Z [Warning] 0/3 nodes are available: 1 Insufficient cpu, 1 Insufficient memory, 2 node(s) didn't match Pod's node affinity/selector. preemption: 0/3 nodes are available: 1 No preemption victims found for incoming pod, 2 Preemption is not helpful for scheduling.` means? It actually means `Determined that a new node is required`, yet it looks far scarier!
2. Some of the messages actually mean the spawn has failed, but there's no clear indication which messages indicate that vs which messages simply are markers of progress.
3. The UX of the progressbar itself is pretty janky, with raw ISO formatted timestamps shown.

We want to improve the UX of this page so it's useful and users will pay attention for it - this prevents 'surprises' as users run out of quota. It should also be made customizable enough so it can be used for quota purposes. This requires upstream contributions to JupyterHub.

This isn't a complete overhaul of the page - only an incremental improvement + some customization hooks.

#### Definition of Done

- [ ] Design a UX mockup of progress page
- [ ] Progress messages from KubeSpawner are translated into more human readable forms. `Determined that a new node is required`, rather than `2025-03-19T00:51:47.961011Z [Warning] 0/3 nodes are available: 1 Insufficient cpu, 1 Insufficient memory, 2 node(s) didn't match Pod's node affinity/selector. preemption: 0/3 nodes are available: 1 No preemption victims found for incoming pod, 2 Preemption is not helpful for scheduling`. We should handle progress events about pods from the following components:
  - [ ] [Kubelet](https://github.com/kubernetes/kubernetes/blob/master/pkg/kubelet/events/event.go#L44)
  - [ ] [Scheduler](https://github.com/kubernetes/kubernetes/blob/83f8513db86649c5dfde1e1f287b867f9da418ee/pkg/scheduler/schedule_one.go#L390) (search for `fwk.EventRecorder`)
  - [ ] [cluster-autoscaler](https://github.com/kubernetes/autoscaler/blob/9937f8f30896ce838d78b24ab0614c9b0152b113/cluster-autoscaler/FAQ.md?plain=1#L1297)
- [ ] UX improvements to the progress events display, so they are more readable.
- [ ] Handle "failure" cases better and bail out early. For example, the `BackOff`, `FailedCreatePodContainer` and similar events should immediately stop the server spawn process and communicate to the user the spawn has failed.
- [ ] Allow hooks to inject additional messages into progress, so our quota enforcement mechanism can inject messages about success or failure into the progress screen
- [ ] This change is deployed to all the hubs

#### Risk Factors

- Upstreaming takes more effort than we realize
  - Mitigation: We can roll this out in a temporary fork while we wait for upstream to go through, so we don't have to block other deliverables
  - Mitigation: I (Yuvi) have reached out to other upstream maintainers to do a quick check on if this is acceptable and desired.

#### Estimates

```{estimate-table}
- - UX mockup
  - 8h
  - 8h
- - Human readable progress messages
  - 24h
  - 32h
- - Allowing hooks to inject progress messages
  - 24h
  - 32h
- - Allowing some progress messages to terminate spawn
  - 24h
  - 32h
- - Upstream co-ordination overhead
  - 24h
  - 32h
```

#### People needed

- App Eng to build out the features

#### Notes

- If necessary, we can cut scope here and remove the UX improvements. We still need to make sure there's a way to 'cancel' spawning at this stage and send the user to their quota page.

#### Demo Reel

1. More UX friendly spawn page for everyone on the earthscope _production_ hub

### Deliverable 5: Integrate Library from (2) into JupyterHub spawning process

#### Overview

During the JupyterHub spawning process, we know what amount of resources (Memory and CPU) the user is requesting. Based on the quota configuration, if this should be **allowed**:

1. We note how much quota the user has consumed, and how much they have left as a 'progress message'

If it should be **denied**:

1. The server is not started
2. A configurable message should be shown to them about this denial, with information on how they can request more quota (by being added to different groups)

#### Definition of done

- [ ] If user is allowed to start server, a message about their remaining quota is shown in the 'progress' part of the server spawn
- [ ] If a user is _not_ allowed to start a server, server start is halted and a configurable (by admins) message is shown to them
- [ ] Documentation on _how_ various quotas can be configured is written
- [ ] Documentation on how the library from Deliverable 2 can be used to _configure_ _any_ JupyterHub (not just 2i2c ones) to this is also written
- [ ] If any changes to JupyterHub itself are required to provide this functionality, those are contributed upstream and merged.
- [ ] This is deployed on the _earthscope staging hub_

#### Estimates

```{estimate-table}
- - Integration work
  - 24h
  - 32h
- - Documentation
  - 8h
  - 8h
```

#### People needed

1. App eng to build out all the hooks and functionality
2. Infrastructure eng to roll this out to our infrastructure

#### Demo Reel

1. Full quota system working and testable in the staging earthscope hub

### Deliverable 6: Production roll-out

#### Overview

So far, we would have deployed to staging clusters and tested. We will need to

#### Definition of Done

- [ ] Roll-out timeline determined based on availability of people on 2i2c and earthscope side for support
- [ ] Actual quota rules to be applied for various users is determined in consultation with earthscope
- [ ] Earthscope handles announcing new quota system to its users
- [ ] Agree to a timeline for expediated support and monitoring around the roll-out period
- [ ] Roll this out to the production earthscope hub.

#### Estimates

```{estimate-table}
- - Coordination with Earthscope
  - 8h
  - 8h
- - Support and monitoring
  - 8h
  - 40h
```

#### Risk factors

- We find lots of gaps in the feature, but that's okay! We consult with Earthscope to gather feedback and enter another iteration of the product if necessary.

#### People needed

1. App eng to fix any issues that may arise
2. Infrastructure eng to support app engineers in this process

#### Demo Reel

1. Full quota system working and testable in the earthscope production hub

## Cloud vendor considerations

There should be no cloud vendor specific parts here - everything should work across cloud vendors.

## People working on this

This project would require capacity from:

1. Tech Lead
2. Infrastructure Engineer
3. App Engineer

In addition, it would also consume cycles from our project management folks.

## Timeline

Some of this work can be done in parallel, depending on availability of capacity.

```{mermaid}
flowchart TD
    A[Metrics Collection #1] -->  C[Show users their quota #4]
    B[Quota Python Library #2] --> C
    D[JupyterHub Spawn Improvements #3] --> C
    C --> E[Deploy to Earthscope Staging #5]
    E --> F[Deploy to Earthscope Prod #6]
```

Based on when we start this, I roughly expect 2-4 months to drive this to completion.

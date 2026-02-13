# Improvements to Conflict Resolution in `nbgitpuller`

## Background

`nbgitpuller` is a Jupyter Server extension that exposes a mechanism for synchronising remote content with the server's local file-system. In the wild, its primary application lies in connecting JupyterHub _users_ with hub-adjacent _content_ through a simple distributable, user-friendly interface (URLs). By virtue of pulling remote content within an individual user's server, it is often used to facilitate the separation of content from compute-environment definitions in contexts like JupyterHub and BinderHub, where rebuilds of the single-user environment are costly and slow.

There are two main personas that use `nbgitpuller`:

Link-author
: People creating content that can be shared via an `nbgitpuller` link.

Link-consumer
: People that use an `nbgitpuller` link to access shared content.

Between fetching remote content and merging conflicts with local edits, there are many ways in which `nbgitpuller` users can encounter errors during normal operation. Fixing these errors is _neither_ the responsibility of link-author nor link-consumers. Instead, there is a third persona:

`nbgitpuller` expert
: People with the technical expertise to debug problems encountered during `nbgitpuller` usage.

Every problem that requires the intervention of an `nbgitpuller` expert introduces a dependency upon the availability of the expert, limiting the scalability of `nbgitpuller`. Reducing the necessity of this role, e.g. by improving conflict resolution, represents a desirable goal for the project.

<!-- BEGIN SHARED BLOCK -->

## Technical details

`nbgitpuller` operates as a Jupyter Server extension that exposes a number of request handlers:

- `GET /git-pull/api` — an API service endpoint
- `GET /git-pull/` — a user-facing UI for triggering and following a `git` pull operation.

The UI served at `/git-pull/` communicates with the API backend from the front-end using [server-sent-events].

When used alongside a JupyterHub, there is a strong separation of concerns between provisioning of the compute environment ([JupyterHub] and e.g. [KubeSpawner]) and provisioning of the file-system ([nbgitpuller]). Using the `/hub/user-redirect/` endpoint, content authors can craft user-agnostic URLs that invoke the nbgitpuller service.

The `nbgitpuller` URL handler (e.g. `GET /git-pull?repo=...`) implements several operations to fulfil a request:

1. Remote content is fetched from a Git repository scoped to a specific branch (`fetch`).
2. Fetched content is merged with the local file-system, resolving any conflicts in an opinionated manner to minimise user-input (`merge`).
3. Redirect user to given URL path once (1) and (2) have been completed (`open`).
<!-- END SHARED BLOCK -->

## Deliverables

### Identify common `nbgitpuller` merge errors

#### Overview

After fetching content from a content-source, `nbgitpuller` is responsible for unifying the remote content with the local user's filesystem (see (2) above). Where the link-consumer and link-author have each made edits to a remote file, it may be possible to account for both sets of changes in a lossless _merge_ operation. However, there are some situations in which it is not possible to merge both the remote and local changes in a conflict-free manner. On these ocasions, `nbgitpuller` should resolve conflicts by preferring the remote content, whilst also preserving the link-consumer's edits.

The nature of these kinds of failures means that they're often content-dependent, and there are anecdotal reports of `nbgitpuller` failing to properly resolve merge conflicts in the wild. These kinds of failures are difficult for link-author and link-consumer personas to resolve; often this requires intervention from the `nbgitpuller`-persona. Through inspection of logs from existing (large) `nbgitpuller` deployments, we will learn more about these kinds of failures in real-world deployments. .

#### Definition of done

- An array of structured `nbgitpuller` events has been generated from existing large JupyterHub deployments logs.
- A set of common error types has been established from analysis of `nbgitpuller` event information.
- An array of structured `nbgitpuller` events has been generated from existing large JupyterHub deployments logs.
- A set of common error types has been established from analysis of `nbgitpuller` event information.
- A set of reproducible merge failures has been identified.

#### Estimates

```{estimate-table}
-  -  Generate structured events from raw logs
   -  6h
   -  10h
-  -  Analyse nbgitpuller events to identify common error types
   -  4h
   -  8h
-  -  Open pull-request and shepherd through to merge
   -  4h
   -  8h
-  -  Additional learning and refinement
   -  2h
   -  6h
```

### Implement fixes to Git-based merge routines

#### Overview

Following the work in the first deliverable, a set of reproducible merge failures will have been identified. Subsequently, work may be done to reduce the likelihood of these kinds of failures in order; by hardening `nbgitpuller` against failure during nominal usage, it may be possible to eliminate and/or diminish in importance the `nbgitpuller`-expert persona.

Alongside implementing fixes for these newly identified merge-failure scenarios, work should be done to embed reproducible test-cases in the `nbgitpuller` test suite.

#### Definiton of done

- A set of reproducible merge failures has been prepared as a test-suite.
- The extended `nbgitpuller` test suite passes.

#### Estimates

```{estimate-table}
-  -  Create reproducible tests for existing merge-failures
   -  8h
   -  12h
-  -  Implement fixes for these test failures
   -  12h
   -  20h
-  -  Open pull-request and shepherd through to merge
   -  4h
   -  8h
-  -  Additional learning and refinement
   -  2h
   -  6h
```

## Additional overheads

In addition to per-deliverable work, there is up-front work that may be paid by each developer:

```{estimate-table}
-  -  Become familiar with nbgitpuller architecture
   -  4h
   -  8h
-  -  Set up development environment
   -  2h
   -  3h
```

We will assume that two separate developers incur this cost.

## Intentionally out of scope

For this statement of work, we are leaving the following as intentionally out of scope:

1. Use of alternative conflict resolution mechanisms besides Git.

## Relevant GitHub Issues and external links

Listed below are pertinent GitHub Issues open in the `jupyerhub/nbgitpuller` repository, and other external resources:

- https://nbgitpuller.readthedocs.io/en/latest/topic/automatic-merging.html
- https://curriculum-guide.datahub.berkeley.edu/support/troubleshooting/nbgitpuller
- https://github.com/jupyterhub/nbgitpuller/issues/153
- https://github.com/jupyterhub/nbgitpuller/issues/327
- https://github.com/berkeley-dsep-infra/datahub/issues/4984

## People working on this

This project would require capacity from:

1. App Engineer (1 implementation, 1 review)

## Timeline

```{mermaid}
flowchart TD
    A[Identify common merge errors]
    B[Fix and test for merge failures]

    A --> B --> X

    X[End]

```

[jupyterhub]: https://github.com/jupyterhub/jupyterhub
[kubespawner]: https://github.com/jupyterhub/kubespawner
[nbgitpuller]: https://github.com/jupyterhub/nbgitpuller
[server-sent-events]: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
[repoproviders]: https://github.com/yuvipanda/repoproviders

# Sustainable first class Canvas Authentication & Authorization support

## Desired outcomes

- Outcome 1: End users can log in to JupyterHubs via their existing Canvas accounts
- Outcome 2: JupyterHub groups are populated from Canvas enrollments at login time, unlocking full range of JupyterHub groups functionality
- Outcome 3: Functionality is developed in a generalized, upstreamable way that benefits everyone, not just 2i2c
- Outcome 4: Enables future Canvas related functionality

## Context

### Canvas

Canvas is a popular [open source](https://github.com/instructure/canvas-lms) LMS that is favored by large universities. It has an extensive [REST API](https://developerdocs.instructure.com/services/canvas) that provides a lot of useful functionality. In particular, it provides standardized [OAuth2](https://developerdocs.instructure.com/services/canvas/oauth2) that can be used for _authentication_ (establishing identity of the user) and [courses](https://developerdocs.instructure.com/services/canvas/file.all_resources/courses) & [groups](https://developerdocs.instructure.com/services/canvas/file.all_resources/groups) for _authorization_ (differential access based on membership).

### JupyterHub and Canvas

JupyterHub supports authentication and authorization with OAuth2 providers using [OAuthenticator](https://github.com/jupyterhub/oauthenticator). Over the last few years, we (2i2c) have helped contribute features to the [GenericOAuthenticator](https://github.com/jupyterhub/oauthenticator/blob/main/oauthenticator/generic.py) which allows for integration with all kinds of OAuth2 providers, rather than writing a specific authenticator for each provider (like [GitHub](https://github.com/jupyterhub/oauthenticator/blob/main/oauthenticator/github.py), etc). This allows for long term maintainability (Outcome 3) as well as faster deploys without having to write new code for each provider.

While this works in very straightforward ways for _authentication_, it doesn't quite for _authorization_. There are no real standards at the OAuth2 level for fetching group memberships, as each provider has a different idea of what groups mean based on what kind of application it is. For example, in GitHub we sync with orgs and teams, while with Canvas we want courses and groups. This is essential complexity of the problem, and we want to find elegant ways to solve it while keeping Outcome 3 in mind.

#### Prior art

Prior art (which current 2i2c members were heavily involved in) we should learn from are:

1. PR to add a [specific Canvas Authenticator](https://github.com/jupyterhub/oauthenticator/pull/406). This was rejected due to its repetitive nature, and the need to add maintain a lot of Canvas specific code in the upstream JupyterHub project. This actively led to work in making the Generic OAuthenticator more capable.
2. UC Berkeley's [CanvasOAuthenticator](https://github.com/berkeley-dsep-infra/canvasoauthenticator), a separately maintained version of the previously mentioned PR. It has been successfully used for thousands of students for 4+ years now, and contains lessons we can learn. In particular, we want to figure out how we can provide all this functionality without having to maintain an external Authenticator, so it can be sustainably upstreamed (Outcome 3).

## Deliverables

### Deliverable 1: Canvas Authentication with GenericOAuthenticator

#### Overview

`GenericOAuthenticator` already has enough functionality to provide _authentication_ only with Canvas. We will set the _staging hub_ with Canvas Authentiction to make sure this works, as well as test our processes, as this requires provisioning keys for our use from Canvas via University IT departments.

#### Definition of Done

- [ ] Make sure 2i2c engineers can access the University's Canvas instance for testing
- [ ] University Canvas administrators provision [OAuth2 client secret and id](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth#oauth2-flow-0) for testing and communicate that to us. This must have enough scopes for us to get list of courses and groups, so we won't need a new set of credentials in the future when we enable groups sync.
- [ ] The _staging hub_ is configured with `GenericOAuthenticator` configured to use these credentials
- [ ] Anyone with access to that Canvas can login to this hub
- [ ] User identifier is matched with what is currently used (email) to make sure that home directory _migration_ is not necessary

#### Risk Factors

- Co-ordination overhead with University Canvas administrators is very high
- The user identifier currently used is incompatible with Canvas's user identification information, requiring a one time home directory migration

#### Demo at the end of this deliverable

A URL to a hub with working Canvas authentication enabled, that anyone with access to that Canvas instance can use to log in.

#### Estimates

```{estimate-table}
1. -  Provision OAuth2 credentials from University IT
   -  2h
   -  4h
1. -  Setup one staging hub with these credentials & document it
   -  3h
   -  6h
1. -  Investigate user identifiers & write a migration plan for home directories
   -  4h
   -  6h
1. -  Migrate all the staging hubs (3 total) & verify they work
   -  3h
   -  4h
```

(2025-10-28: Totals were updated by @colliand following a request from Harneer Batra.)

#### Who works on this?

- Infrastructure Engineer
- Tech Lead

### Deliverable 2: Migrate all production hubs to using Canvas authentication

#### Overview

Once we are comfortable with Deliverable 1, we roll this out carefully to all the other hubs. Primary care must be taken here to make sure home directories work appropriately.

#### Definition of done

- [ ] Verify that resetting users' JupyterHub session cookie secret doesn't affect running users. If it does, we will need to schedule at least a few minutes of downtime for this migration. If it doesn't this can be done without downtime.
- [ ] Migrate all the existing production hubs, one by one.
- [ ] Watch for a week to ensure there are no issues. In particular, if the user identifier for any user is different, we may have to do a one time migration for specifically affected users.

#### Risk factors

- User identifier is different for a large enough number of users that we have to do multiple migrations manually

#### Demo at the end of this deliverable

All production hubs have users logging in via Canvas

#### Estimates

```{estimate-table}
1. -  Verify & document how resetting hub session cookie affects running users
   -  1h
   -  2h
1. -  Make a migration plan with timelines agreed upon by 2i2c & the University
   -  2h
   -  3h
1. -  Migrate `highmem` hub
   -  4h
   -  8h
1. -  Migrate `r` hub
   -  4h
   -  8h
1. -  Migrate main hub
   -  4h
   -  8h
1. -  Map exiting home directories names to new names (if user identifiers are different, as determined in migration plan in Deliverable 1)*
   -  6h
   -  8h
1. -  Watch for and address any support issues for a week
   -  4h
   -  4h
```

#### Who works on this?

- Infrastructure Engineer
- Tech Lead

### Deliverable 3: Build `jupyterhub_oauthenticator_authz_helpers`

#### Overview

Since [this contribution](https://github.com/jupyterhub/oauthenticator/pull/735) we made to OAuthenticator, the general pattern for bringing groups into JupyterHub from an external source is:

1. Talk to the external API to fetch groups information during login and figure out what groups the user belongs to
2. Put that in the user's `auth_state`
3. Use `auth_state_groups_key` to pick that out as groups information

This allows easy separation of concerns - `auth_state` can securely contain many different pieces of info about the user, and `auth_state_groups_key` can be used to determine groups. If in the future we want to refresh group information more regularly, that can be done by simply refereshing `auth_state`.

This pattern also matches how this is done in OAuthenticator itself for providers it directly supports (see [GitHub](https://github.com/jupyterhub/oauthenticator/pull/498) for example).

While we _could_ simply write do (1) in our config, this is not scalable nor upstreamable (Outcome 3). Instead, we want to create a new python package, `jupyterhub_oauthenticator_authz_helpers` that contains helpful utilities for fetching groups info from various OAuth2 providers. This allows anyone to compose various info they want to get into (1) without having to copy paste python code into YAML everywhere.

There's [prior art](https://github.com/berkeley-dsep-infra/canvasoauthenticator) that can we can use in accordance with the license + with the blessing of the people who wrote them.

#### Definition of done

- [ ] `jupyterhub_oauthenticator_authz_helpers` python project is set up (README, tests, CI, etc)
- [ ] A helper function for fetching Canvas Course enrollments is added
- [ ] A helper function for fetching Canvas Group enrollments is added
- [ ] To make sure that this library is generalizable, a helper function for a non-canvas OAuth2 provider (to be determined later) is also added
- [ ] Documentation for how these various helpers can be _composed_ together to populate `auth_state` is added
- [ ] A release of this package is made to PyPI
- [ ] `jupyterhub_oauthenticator_authz_helpers` is installed in our hub image
- [ ] A staging hub is configured to bring in both Canvas course enrollments and group enrollments as groups. Any modifications (or releases) to the package needed to achieve this are done.
- [ ] Test restricting access to people enrolled in a particular series of courses only on the staging hub, and adjust our code until this works appropriately.
- [ ] Ensure that `jupyterhub-groups-exporter` picks up these groups correctly, so they can be used appropriately for reporting in Grafana.
- [ ] Ensure that we can show different sets of profile options to users based on their group membership. This isn't currently used for many educational hubs, but is an important feature that we must verify works so that communities can opt in to it in the future if they so desire.
- [ ] A blog post is written announcing this package and how it can be used.

#### Risk factors

- We discover that integration into `auth_state` is missing some pieces, and we have to make further upstream contributions before this can be implemented
- We discover that building out helpers that can reliably and structurally similarly work with different providers in the same package is difficult, and we have to narrow our scope to just Canvas

#### Demo at the end of this deliverable

- A URL to a staging hub with canvas authentication. When any user logs into this hub, all the courses and groups they are a part of in Canvas gets reflected in their group membership in JupyterHub. Re-logging in refreshes these. Groups can be viewed in Grafana or the JupyterHub admin interface.
- A URL to a staging hub where only users belonging to a specific course or group (as configured) can login. Anyone else attempting to login gets a permission error.

#### Estimates

```{estimate-table}
1. -  Setup the python project
   -  1h
   -  2h
1. -  Set up local Canvas environment for testing
   -  4h
   -  8h
1. -  Build helper function for fetching Canvas course enrollments into `auth_state`
   -  4h
   -  10h
1. -  Build helper function for fetching Canvas group membership into `auth_state`
   -  4h
   -  10h
1. -  Implement an additional, non Canvas `auth_state` helper to ensure the design is not tied to Canvas
   -  6h
   -  8h
1. -  Build scaffolding so admins can compose various helper functions to pick up authorization info into `auth_state`
   -  8h
   -  16h
1. -  Add package to the hub image, and test on a staging hub
   -  8h
   -  16h
1. -  Configure staging hub to make enrollments into jupyterhub groups
   -  4h
   -  6h
1. -  Test restricting users based on courses they are in works (and fix bugs if it isn't)
   -  4h
   -  8h
1. -  Test that `jupyterhub-groups-exporter` picks these up, so grafana reporting shows groups
   -  4h
   -  6h
1. -  Test that we can show different profile options to users based on group membership
   -  2h
   -  4h
1. -  Write a blog post announcing this work (and credit everyone)
   -  2h
   -  4h
```

#### Who works on this?

- Infrastructure Engineer
- App Engineer
- Tech Lead

### Deliverable 4: Upstream governance work towards setting up `jupyterhub-contrib`

#### Overview

As part of both Outcome 3 and our Right to Replicate, we want to ensure that code we write is upstreamed as much as possible. This requires governance of our code to be _multi stakeholder_, which allows for a large community of users to pitch in towards long term maintenance. Historically, this has meant upstreaming projects that have a wide user base into the JupyterHub organization itself. However, as JupyterHub has matured and grown, this is not necessarily viable - the number of projects with a wide audience is much larger than what the JupyterHub core team can maintain. While keeping projects under the 2i2c-org organization is temporarily ok, that is not as good a long term space as building a proper multi-stakeholder space where such projects can exist.

There is ongoing governance work in the JupyterHub ecosystem that 2i2c folks are involved in towards [setting up a jupyterhub-contrib](https://github.com/jupyterhub/team-compass/issues/519) space that is exactly that. Given how broadly used Canvas is, and the desire to continue using it without having to be the sole maintainers of it, `jupyterhub_oauthenticator_authz_helpers` would make a fantastic addition to such a space once it exists.

As part of this project, to contribute towards Outcome 3, we would like to spend some hours doing the governance and community work required to set this project space up. It may not be fully complete as part of this particular statement of work, but by collectively putting hours towards it via various statements of work with different communities, we are able to provide value to all of them without any one of them having to bear the whole cost.

#### Definition of Done

- [ ] 20h of time put into governance and community work for forming the jupyterhub-contrib space.
- [ ] (If the work is done within 20h) Find additional stakeholders so we can move `jupyterhub_oauthenticator_authz_helpers` into this space

#### Risk factors

- There is not enough community support for such an organizational space, and our time is spent in vain. However, we have had enough other conversations with key stakeholders to believe that the risk of this is low.

#### Demo at the end of this deliverable

Either a charter document about the existence of jupyterhub-contrib, or a report on how we have spent the 20h and what the current status is.

#### Estimates

- Governance and Community Work - Capped at 20h.

#### Who will work on this

- Tech Lead

### Deliverable 5: Deploy `jupyterhub_oauthenticator_authz_helpers` to production hubs

#### Overview

At the end of Deliverable 4, we would have deployed Canvas groups functionality to a staging hub. Similar to Deliverable 2, we will now roll this out carefully to all the production hubs.

#### Definition of done

- [ ] Determine which hub (if any) we want to restrict to only users who are enrolled in a specific course.
- [ ] Verify that resetting users' JupyterHub session cookie secret doesn't affect running users. If it does, we will need to schedule at least a few minutes of downtime for this migration. If it doesn't this can be done without downtime.
- [ ] Migrate all the existing production hubs, one by one.
- [ ] Watch for a week to ensure there are no issues. In particular, if the user identifier for any user is different, we may have to do a one time migration for specifically affected users.
- [ ] If we have determined that some hub is going to be restricted to only users in a specific course, roll out that config and validate it for a week.

#### Risk Factors

- There are bugs we don't catch in the staging area, and have to deal with in production.

#### Demo at the end of this deliverable

Same as Deliverable 3 but for all production hubs.

#### Estimates

```{estimate-table}
1. -  Migrate `highmem` hub, potentially restrict it to specific sets of users
   -  4h
   -  6h
1. -  Migrate `r` hub
   -  2h
   -  4h
1. -  Migrate main hub
   -  2h
   -  4h
1. -  Watch for and address any support issues for a week
   -  4h
   -  4h
```

#### Who works on this?

- Infrastructure Engineer
- App Engineer
- Tech Lead

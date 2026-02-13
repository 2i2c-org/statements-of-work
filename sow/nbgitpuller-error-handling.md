# Improved Error Handling in `nbgitpuller`

<!-- BEGIN SHARED BLOCK -->

## Background

`nbgitpuller` is a Jupyter Server extension that exposes a mechanism for synchronising remote content with the server's local file-system. In the wild, its primary application lies in connecting JupyterHub _users_ with hub-adjacent _content_ through a simple distributable, user-friendly interface (URLs). By virtue of pulling remote content within an individual user's server, it is often used to facilitate the separation of content from compute-environment definitions in contexts like JupyterHub and BinderHub.

There are two distinct personas that use `nbgitpuller`:

Link-author
: People creating content that can be shared via an `nbgitpuller` link.

Link-consumer
: People that use an `nbgitpuller` link to access shared content.

Between fetching remote content and merging conflicts with local edits, there are many ways in which `nbgitpuller` users can encounter errors during normal operation. Fixing these errors is _neither_ the responsibility of link-author nor link-consumers. Instead, there is a third persona:

`nbgitpuller` expert
: People with the technical expertise to debug problems encountered during `nbgitpuller` usage. It is an established `nbgitpuller` devlopment goal that this role dissapears in the future.

<!-- END SHARED BLOCK -->

The existing UX for error handling confuses the persona of `ngitpuller`-experts with that of the link-consumer and link-author personas. As such, it leaves room for improvement, such as through the addition of error recovery mechanisms, or designing error responses that consider the needs of the link-consumer and link-author personas _in addition to_ `nbgitpuller`-expert.

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

### Add access to a Jupyter frontend following an `nbgitpuller` error

#### Overview

For some users, `nbgitpuller` links are the _only_ way that they are familiar with to access a deployed JupyterHub. At present, when such a user encounters an error after following an `nbgitpuller` link, e.g. because the link is malformed, they find themselves without any navigation links or buttons that will take them to the "preferred"[^pref] frontend e.g. JupyterLab. These users need a way to access the preferred frontend application without modifying the URL bar of their browser or otherwise navigating to the JupyterHub by themselves.

We will extend the existing error response of the `nbgitpuller` web UI to provide a means of accessing the preferred frontend, such as through the addition of a clickable link or button. An automatic redirect should not be used, as it hinders the ability of the link _user_ to capture debugging information for the link _author_ when the link fails.

#### Definition of done

- Users can navigate through to the preferred frontend from any `nbgitpuller` error response.

#### Estimates

```{estimate-table}
1. -  Build routine to identify "preferred" UI application
   -  2h
   -  3h
1. -  Design and implement UI
   -  1h
   -  3h
1. -  Open pull-request and shepherd through to merge
   -  2h
   -  4h
1. -  Additional learning and refinement
   -  1h
   -  3h
```

### Redesign the error handling response for link-consumers

#### Overview

The existing error-handling response for `nbgitpuller` is a thin abstraction which exposes many of the error details to the user. In practice, many users may not be familiar with Git, and/or may have limited ability to interpret the error messages. When designing for the link-consumer persona, we should prioritise simple, readable error messages that provide sufficient scope for the link-author (e.g. Teaching Assistants, Lecturers). Crucially, it should be possible for the majority of `nbgitpuller` errors to be understood without the use of the existing console window to read error log output. A convenient way to share the log outputs should be added, such as a <kbd>Copy to clipboard</kbd> button.

Fundamental changes to the technology stack, such as introducing a new UI framework, are NOT in scope.

#### Definition of done

- Users can encounter errors during `nbgitpuller` that provide a clear indication that an error occurred without the use of a console window.
- Link authors can recover useful debugging information from screenshots and/or verbal descriptions of the error page.

#### Estimates

```{estimate-table}
1. -  Design and implement UI
   -  5h
   -  8h
1. -  Open pull-request and shepherd through to merge
   -  2h
   -  4h
1. -  Additional learning and refinement
   -  1h
   -  3h
```

### Identify common `nbgitpuller` errors

#### Overview

Within the space of possible errors that can occur during typical usage of `nbgitpuller`, there are several common classes, such as invalid links, renamed / deleted files, etc. Through inspection of logs from existing (large) `nbgitpuller` deployments, we will determine which `nbgitpuller` invocations failed, and the mechanism by which they failed (normalised by `nbgitpuller` URL). By analysing the resulting set of events, we will identify the most frequent failure modes normalised by link.

#### Definition of done

- An array of structured `nbgitpuller` events has been generated from existing large JupyterHub deployments logs.
- A set of common error types has been established from analysis of `nbgitpuller` event information.

#### Estimates

```{estimate-table}
1. -  Liaise with appropriate personas associated with existing JupyterHub deployments
   -  4h
   -  11h
1. -  Generate structured events from raw logs
   -  3h
   -  7h
1. -  Analyse nbgitpuller events to identify common error types
   -  2h
   -  4h
1. -  Open pull-request and shepherd through to merge
   -  2h
   -  4h
1. -  Additional learning and refinement
   -  1h
   -  3h
```

### Design and integrate dedicated error handlers

#### Overview

For the set of common error classes identified in the previous deliverable, we will design _up to three_ bespoke responses that clearly articulate what went wrong to link _users_ that encounter each error. Although it will be the responsibility of the link _author_ to resolve these problems, improving the error message will help guide the user to useful documentation and/or provide more context for the link _author_ when the error is reported.

The primary objective of this deliverable is to reduce the requirement for link _authors_ to draw conclusions from inline console tracebacks. The approach taken in this work should naturally extend to alternative content providers, should they be added in future.

Once each error class has a dedicated response, `nbgitpuller` will be extended to return these responses when it identifies a particular error class has been encountered.

> [!Note]
> There is a strong case here to treat `urlPath` errors as an `nbgitpuller` error, because we parse this component and trigger a redirect. Therefore, programatically detecting a failure here seems reasonable, rather than falling back upon the `jupyter-server` 404 handler. Whether this is actioned will follow from the error analysis results.

#### Definition of done

- Users encountering one of three commonly-encountered errors are presented with a specialised error handler that provides useful context.

#### Estimates

```{estimate-table}
1. -  Build error-handling routines to process and identify common failure modes
   -  3h
   -  7h
1. -  Design and implement UI
   -  7h
   -  12h
1. -  Update nbgitpuller documentation
   -  1h
   -  2h
1. -  Open pull-request and shepherd through to merge
   -  2h
   -  4h
1. -  Additional learning and refinement
   -  1h
   -  3h
```

## Additional overheads

In addition to per-deliverable work, there is up-front work that may be paid by each developer:

```{estimate-table}
1. -  Become familiar with nbgitpuller architecture
   -  2h
   -  4h
1. -  Set up development environment
   -  1h
   -  2h
```

We will assume that two separate developers incur this cost.

## Relevant GitHub Issues

Listed below are pertinent GitHub Issues open in the `jupyerhub/nbgitpuller` repository:

- [Missing `.git` directory](https://github.com/jupyterhub/nbgitpuller/issues/354)
- [Add a "Proceed to destination" button when pulling fails](https://github.com/jupyterhub/nbgitpuller/issues/278)
- [Untracked files that will be overwritten causing failure](https://github.com/jupyterhub/nbgitpuller/issues/277)
- [Provide better error messages in the terminal](https://github.com/jupyterhub/nbgitpuller/issues/267)
- [Provide helpful error message when git url is wrong](https://github.com/jupyterhub/nbgitpuller/issues/198)
- [Document that users shouldn't actively be running git commands along with nbgitpuller ](https://github.com/jupyterhub/nbgitpuller/issues/314)
- [Automagically resolve conflicts upon remote deletion/moves](https://github.com/jupyterhub/nbgitpuller/issues/69)

## People working on this

This project would require capacity from:

1. App Engineer (1 implementation, 1 review)

## Timeline

```{mermaid}
flowchart TD
    A[Identify common errors]
    B[Design & integrate bespoke responses]
    D[Add access to frontend]
    E[Make errors user-friendly]

    A --> B --> X
    D --> X
    E --> X

    X[End]
```

[jupyterhub]: https://github.com/jupyterhub/jupyterhub
[kubespawner]: https://github.com/jupyterhub/kubespawner
[nbgitpuller]: https://github.com/jupyterhub/nbgitpuller
[server-sent-events]: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

[^pref]: Where "preferred" refers to _either_ the pre-determined singleuser endpoint, or the application indicated in the `urlPath` query.

# A New Binderbot for Remote Execution of MyST Projects

## Background

BinderHub is

> [...] a kubernetes-based cloud service that allows users to share reproducible interactive computing environments from code repositories. [...]
>
> — https://binderhub.readthedocs.io/en/latest/

Its most popular deployment is the public MyBinder federation, which exposes an unauthenticated BinderHub instance under the `https://mybinder.org` domain.

The [Binderbot CLI][binderbot] is a tool for executing local Jupyter Notebooks on a remote [BinderHub][binderhub], facilitating the use of expensive cloud resources in restricted computation environments such as (free) GitHub Actions runners. It was developed by the Pangeo community, and has received little development over the past few years such that it is now considered end-of-life. The commandline interface accepts a set of notebook filenames that should be executed, and the URL of a BinderHub that should perform the execution.

:::{note}
Remote execution of local Jupyter Notebooks, as described in this document, is a distinct concept from in-browser computation of notebooks using technologies such as Thebe.
:::

The existing code is fragile, and does not integrate directly with tools like Jupyter Book or the [MyST Document Engine][mystmd] for building rich narrative experiences from computational notebooks. This statement of work outlines an approach for addressing the remote-execution problem that replaces Binderbot with CLI tool and GitHub action for starting a BinderHub session. The intention is to replace Binderbot with a small, fit-for-purpose tool whilst admitting future efforts that can focus on solving the broader problems associated with remote computation.

## User stories

Binderbot is a technical tool that facilitates the following user stores:

- As a researcher, I want to run computation in a remote context in order to leverage colocation of my dataset.
- As a communicator, I want to build and share reproducible scientific notebooks on a remote executor in order to leverage dedicated compute resources during execution.
- As a research software engineer, I want to perform remote execution of computational artifacts in order to take advantage of existing continuous integration platforms.

## Technical details

Under the hood, Binderbot handles a number of distinct responsibilities:

1. Establishing a BinderHub session on a remote BinderHub using a configurable GitHub repository to determine the environment specification.
2. Starting a kernel for remote code execution.
3. Uploading local notebooks to the remote BinderHub session.
4. Sending a code shim that handles execution of a particular notebook.
5. Writing executed notebooks back to the local file system.
6. Tearing down the BinderHub session.

Tools like [Jupyter Book 2](https://next.jupyterbook.org/) and the [MyST Document Engine][mystmd] integrate with [Jupyter Server][jupyter-server] via the [Jupyter services REST API][rest-api], which facilitates starting kernels, uploading files, etc. Presently, like Binderbot, these tools do not attempt to validate that the local and remote environments share the same resources (such as data files). Instead, fragments of code are sent to the remote kernel, and the responses consumed by the application.

The MyST Document Engine may consume the URL to a running Jupyter Server rather than attempting to start a local server. It follows that by building a new application with the distinct responsibility of managing the lifecycle of a BinderHub session (`clinder`), it will be possible to perform remote execution of MyST projects by passing the URL of a running BinderHub session to the MyST Document Engine. Future work may build upon this platform to invoke remote procedure calls, upload files, and perform other useful functions through the REST API exposed by Jupyter Server.

## Deliverables

### Build a new CLI for managing an unauthenticated BinderHub session

#### Overview

The existing Binderbot CLI has too many responsibilities. A replacement tool will be built that:

1. Starts a single remote BinderHub session `clinder start`, and outputs the running session information as structured data or a URI-with-token.
2. Tears down the existing session `clinder stop <URI>`

Under the hood, Binderbot handles a number of distinct responsibilities:

1. Establishing a BinderHub session on a remote BinderHub using a configurable GitHub repository to determine the environment specification.
2. Tearing down the BinderHub session.

#### Definition of done

- It is possible to use the new `clinder` CLI to start a remote Jupyter Server on a BinderHub.
- It is possible to consume the session URI in a tool like the MyST Document Engine to perform remote execution.
- The `clinder` tool has a test suite.
- Documentation for the tool, such as configuration options, has been published.

#### Estimates

```{estimate-table}
1. - Familiarise oneself with MyST execution and Binderbot v1
   - 1h
   - 3h
1. - Build Node.js script to launch and stop BinderHub sessions
   - 1h
   - 3h
1. - Publish script as package on GitHub and npm with CI releases
   - 2h
   - 4h
1. - Code review
   - 1h
   - 1h
```

### Build a new GitHub action for managing BinderHub sessions in CI

#### Overview

The Project Pythia project is most likely to consume the new `clinder` tool inside a GitHub Actions workflow. A new GitHub Action will be built to simplify this workflow, for example by handling session shutdown automatically. The new GitHub action may also set the necessary environment variables for tools like the MyST Document Engine to consume the BinderHub session URL, and determine the current GitHub repository for defining the BinderHub specification.

#### Definition of done

- A new GitHub action has been published on GitHub marketplace.
- An example workflow that uses this action has been published.
- Documentation for the new action, such as configurable options, has been published.

#### Estimates

```{estimate-table}
1. - Create GitHub action that outputs BinderHub information as variables
   - 1h
   - 3h
1. - Publish GitHub action to GitHub Actions Marketplace
   - 1h
   - 2h
1. - Create demonstration resource that uses this action
   - 1h
   - 2h
1. - Code review
   - 1h
   - 1h
```

### Support Project Pythia in migrating to the new tool

#### Overview

The Project Pythia project has a [cookbook template] and a number of cookbook repositories that have been built from it. Each of these repositories references a bespoke set of [cookbook actions] that are used to centralise the implementation of cookbook CI/CD semantics. We will dedicate time to upgrading this set of GitHub Actions such that they use the new `clinder` tool.

#### Definition of done

- The [cookbook actions] repository has been updated to use the new `clinder` tooling.
- An existing cookbook that uses the current version of `binderbot` is able to build successfully after migration.

#### Estimates

```{estimate-table}
1. - Become familiar with the Project Pythia cookbook actions
   - 1h
   - 1h
1. - Update the cookbook actions to use the new `clinder` tool & deploy to a test branch
   - 1h
   - 2h
1. - Fork an existing cookbook and test it against the forked actions
   - 1h
   - 2h
1. - Identify and fix outstanding bugs
   - 1h
   - 3h
1. - Review and deploy new version of actions to `main` branch
   - 1h
   - 2h
```

## Intentionally out of scope

For this statement of work, we are leaving the following as intentionally out of scope:

1. A job-scheduling system (i.e. total-project execution on a remote BinderHub).
2. Sidecar state management (i.e. uploading data files to the remote BinderHub session, modifying the environment variables).  
   See [jupyter-environment-provisioner] for an example of updating the environment variables.
3. Authenticated BinderHub support. This is an important use case, but something that we should follow up with in a second SoW.

## Relevant GitHub Issues and external links

Listed below are pertinent GitHub Issues:

- https://github.com/jupyter-book/mystmd/issues/1498
- https://github.com/ProjectPythia/cookbook-actions/issues/139

## People working on this

This project would require capacity from:

1. App Engineer (1 implementation, 1 review)

## Timeline

```{mermaid}
flowchart TD
    A[Build new CLI BinderHub session manager]
    B[Build new GitHub actions for BinderHub session management]

    A --> B --> X

    X[End]

```

[mystmd]: https://hackmd.io/@agoose77/HJPZaOamxe
[binderbot]: https://github.com/pangeo-gallery/binderbot
[binderhub]: https://binderhub.readthedocs.io/en/latest/index.html
[rest-api]: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/jupyter-server/jupyter_server/main/jupyter_server/services/api/api.yaml
[jupyter-server]: https://jupyter-server.readthedocs.io/en/latest/index.html
[jupyter-environment-provisioner]: https://github.com/agoose77/jupyter-environment-provisioner
[cookbook actions]: https://github.com/ProjectPythia/cookbook-actions
[cookbook template]: https://github.com/ProjectPythia/cookbook-template

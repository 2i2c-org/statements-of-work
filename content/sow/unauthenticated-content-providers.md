# Additional unauthenticated content-providers in `nbgitpuller`


## Background
`nbgitpuller` is a Jupyter Server extension that exposes a mechanism for synchronising remote content with the server's local file-system. In the wild, its primary application lies in connecting JupyterHub _users_ with hub-adjacent _content_ through a simple distributable, user-friendly interface (URLs). By virtue of pulling remote content within an individual user's server, it is often used to facilitate the separation of content from compute-environment definitions in contexts like JupyterHub and BinderHub, where rebuilds of the single-user environment are costly and slow.

There are several main personas that use `nbgitpuller`:

Link-author
: People creating content that can be shared via an `nbgitpuller` link.

Link-consumer
: People that use an `nbgitpuller` link to access shared content.

`nbgitpuller` expert
: People with the technical expertise to debug problems encountered during `nbgitpuller` usage. It is an established `nbgitpuller` devlopment goal that this role dissapears in the future.

Although `nbgitpuller` and BinderHub both understand the concept of "remote content", the two projects do not take the same approach to *describing* remote content or fetching it. For example, whilst BinderHub is able to resolve DOI references to compute environment definitions, link-authors wishing to provision those environments with remotely defined content are forced to use a Git provider such as GitLab for their content. 

<!-- BEGIN SHARED BLOCK -->
## Technical details
`nbgitpuller` operates as a Jupyter Server extension that exposes a number of request handlers:
- `GET /git-pull/api` — an API service endpoint
- `GET /git-pull/` — a user-facing UI for triggering and following a `git` pull operation.

The UI served at `/git-pull/` communicates with the API backend from the front-end using [server-sent-events].

When used alongside a JupyterHub, there is a strong separation of concerns between provisioning of the compute environment ([JupyterHub] and e.g. [KubeSpawner]) and provisioning of the file-system ([nbgitpuller]). Using the `/hub/user-redirect/` endpoint, content authors can craft user-agnostic URLs that invoke the `nbgitpuller` service.

The `nbgitpuller` URL handler (e.g. `GET /git-pull?repo=...`) implements several operations to fulfil a request:
1. Remote content is fetched from a Git repository scoped to a specific branch (`fetch`).
2. Fetched content is merged with the local file-system, resolving any conflicts in an opinionated manner to minimise user-input (`merge`).
3. Redirect user to given URL path once (1) and (2) have been completed (`open`).
<!-- END SHARED BLOCK -->

## Deliverables

### Add new `/pull` endpoint that uses `repoproviders`

#### Overview

The [repoproviders] package, spun out of the BinderHub project, is a tool designed to answer the problem of fetching arbitrary remote content from a URI. This might be a URI to a DOI, or a GitHub URL. It is used in the BinderHub project to fetch remote environment definitions that can be built by `repo2docker` into execution environments.

By integrating this project with `nbgitpuller`, the language for describing a compute environment and the content that is associated with it can be unified, and the implementation for resolving these definitions can be shared. This will provide link-authors with a greater number of content-provider choices, and eliminate the subtle points of friction that the existing solution suffers from.

We will build a new `nbgitpuller` endpoint that utilises `repoproviders` to fetch remote content, and implement support for merging the result with the existing user's filesystem. This endpoint will accept arguments as URL parameters:

`url` 
: the URI (WHATWG prefer URL) of the remote content, e.g. `doi:10.48550/arXiv.0711.3041`. Whilst repoproviders supports implicit schemes (e.g. for DOIs), we can safely restrict valid inputs to URLs (which require a scheme to be defined).

`dest`
: the file-path at which the downloaded content will be merged with the local file-system.

`on-success`
: the destination to navigate to on success. This may be a URL path component taken relative to the server base URL

For example, to pull content from `https://github.com/data-8/materials-sp25`, and navigate to the file `materials-sp25/lec/lec01/lec01.ipynb` when finished:
```
GET /pull?url=https%3A%2F%2Fgithub.com%2Fdata-8%2Fmaterials-sp25&on-success=lab%2Ftree%3A%2F%2Fmaterials-sp25%2Flec%2Flec01%2Flec01.ipynb
```

<!-- > [!Note]
> Should we namespace these handlers, to be a good citizen? e.g. 
> `/nbgp/pull?`
>-->


#### Definition of done

- Valid `repoprovider` GitHub URLs can be provided to `nbgitpuller` and used to provision content.
- Valid (fetchable) `repoprovider` non-GitHub URLs, such as bare Git URLs, can be provided to `nbgitpuller` and used to provision content (see [repoproviders] for the exhaustive list).


#### Estimates
| Task                                            | Lower Estimate | Upper Estimate |
|-------------------------------------------------|----------------|----------------|
| Build `/pull` endpoint                          | 9h             | 15h            |
| Write tests for repoprovider endpoint           | 1h             | 5h             |
| Open pull-request and shepherd through to merge | 2h             | 4h             |
| Additional learning and refinement              | 1h             | 3h             |
| **Total**                                       | **26h**        | **49h**       |


### Add support for merging non-Git content

#### Overview

When users have previously loaded an `nbgitpuller` link, they may already have a snapshot of the resource on their local file-system. The addition of support for non-Git sources requires revisiting the same link neither overwrites their local changes, nor ignores any changes to the remotely referenced content. The existing tooling in `nbgitpuller` assumes that the remote content is backed by a Git repository, and uses the Git CLI to resolve differences with the local file system. This model does not naively apply in the Git-free case.

The most direct solution to this problem is to establish sufficient state for the non Git-backed content providers such that Git can be used as a three-way merge tool. This might, for example, mean creating a `.git` directory adjacent to the content. In order for merging to be more robust, we need to be able to treat the real-world complexity of a scenario in which the remote _and_ local content have both been modified. When building a Git-backed mechanism for merging, we should choose to treat this as an implementation detail. 


#### Definition of done

- It is possible to merge remote content that is only available as a non Git-provided snapshot.
- The new merge logic has thorough tests that match the comprehensiveness of the existing test suite.


#### Estimates
| Task                                                                       | Lower Estimate | Upper Estimate |
|----------------------------------------------------------------------------|----------------|----------------|
| Perform spike into using repoprovider metadata to record ancestor tracking | 4h             | 8h             |
| Perform spike into three-way merging of non-Git sources                    | 7h             | 11h            |
| Implement support for three-way merging using Git as a merge tool          | 12h            | 20h            |
| Write tests for merging logic                                              | 8h             | 14h            |
| Open pull-request and shepherd through to merge                            | 4h             | 8h             |
| Additional learning and refinement                                         | 2h             | 6h             |
| **Total**                                                                  | **37h**        | **67h**       |


### Extend support for fetching and resolving non-Git content in `repoproviders`

#### Overview

Presently, `repoproviders` is able to fetch and resolve Git and Dataverse sources. We should extend that to include Zenodo dataset URLs and and HTTPS ZIP URLs which may point to arbitrary collections of content.

To support ZIP files, we could switch on the `.zip` URL path suffix. Another approach might be to lean-in to the use of [PEP-440 Direct References] to signal that a file should be treated as a ZIP via content-negotiation (e.g. for use with Dropbox download links), e.g. `https+zip://...`.


#### Definition of done

- It is possible to fetch and resolve two additional link types, Zenodo and ZIP, with `nbgitpuller`.
- New test coverage has been established for the additional link types.


#### Estimates
| Task                                              | Lower Estimate | Upper Estimate |
|---------------------------------------------------|----------------|----------------|
| Identify suitable approach for declaring ZIP URLs | 4h             | 8h             |
| Add support for resolving and fetching ZIP URLs   | 4h             | 8h             |
| Add tests to cover fetching new ZIP URLs          | 5h             | 9h             |
| Add support for fetching Zenodo dataset URLs      | 6h             | 11h            |
| Add tests to cover fetching Zenodo dataset URLs   | 5h             | 9h             |
| Add tests to nbgitpuller for ZIP and Zenodo URLs  | 3h             | 6h             |
| Open pull-request and shepherd through to merge   | 4h             | 8h             |
| Additional learning and refinement                | 2h             | 6h             |
| **Total**                                         | **33h**       | **65h**        |


### Update link-generator to use support `repoprovider` URLs

#### Overview

The intention behind `nbgitpuller` URLs is that they are opaque tokens for link-authors and link-consumers. As such, the preferred way to author a link is via a user-interface, and the preferred way to consume the result is by navigating to the URL via a web-browser. In this deliverable, we will update the link-generator interface to use the proposed `/pull?` endpoint.

The new `repoproviders`-backed handler accepts a variety of different inputs whose structure is encoded in the URL. Certain supported URLs have distinct schemes (like `doi:` or `git+https:`) which convey additional validation constraints on top of general URL validation rules; a DOI-URL (<doi:10.48550/arXiv.0711.3041>) must start with `10.`, and must consist of a prefix and suffix. Meanwhile, other URLs may be aliases; for example, https://arxiv.org/abs/0711.3041 is an alias of <doi:10.48550/arXiv.0711.3041>. 

A naive implementation of the link generator needs only to URI encode the various query parameters defined by the `/pull` endpoint. Without any validation, this approach will not protect link-authors from constructing broken `nbgitpuller` links. Whilst we cannot entirely protect from broken links (for example, the remote resources may be inaccessible at the moment that a link-consumer accesses an `nbgitpuller` URL), we should try to minimise the risk of this occuring due to user-error. As such, we must look to define a input validation layer.

A longer-term solution may involve building a server-side validator that exposes `repoproviders` as a web-service. For the purposes of _this_ statement of work, we can prioritise lightweight client-side validation through a combination of known-schemes and known-hosts, e.g. a regex validator for the following:

- `doi:` — DOI validation.
- `git+https` — HTTPS Git validation.
- `https:` — GitHub, GitLab, Zenodo, Dataverse, etc. validation.

These validators should strictly reject known-invalid input _only_. This will protect against e.g. malformed GitHub links while allowing e.g. arbtitrary HTTPS URLs to validate successfully.

An important feature of the link-generator user interface is the ability to share a link *to the generator* that pre-populates particular fields. It may be useful to support defining a-priori the _kind_ of resource that the link generator should be given, so that e.g. an `nbgitpuller`-expert can provide link-authors with a pre-configured DOI-link generator.


#### Definition of done

- Users can create `nbgitpuller` links that resolve against the `/pull` endpoint
- Invalid inputs like malformed GitHub URLs present the user with a human-readable error message, and prevent link generation.


#### Estimates
| Task                                                 | Lower Estimate | Upper Estimate |
|------------------------------------------------------|----------------|----------------|
| Rewrite link-generator UI to generate git-pull links | 15h            | 30h            |
| Open pull-request and shepherd through to merge      | 4h             | 8h             |
| Additional learning and refinement                   | 2h             | 6h             |
| **Total**                                            | **21h**        | **38h**       |

### Rework existing Git provider to leverage `repoproviders` (optional)

#### Overview

After building support for `repoproviders`, we will have a larger maintenance burden as we retain the existing `nbgitpuller` interface. We can reduce this burden by reworking the existing endpoint to use `repoproviders` under the hood.

#### Definition of done

- The `git-pull` interface uses `repoproviders` under the hood.
- Existing usage of `git-pull` URLs do not break.

#### Estimates
| Task                                                                  | Lower Estimate | Upper Estimate |
|-----------------------------------------------------------------------|----------------|----------------|
| Replace GitPuller machinery with existing repoprovider implementation | 7h             | 11h            |
| Ensure that existing git-pull test suite continues to pass            | 4h             | 7h             |
| Open pull-request and shepherd through to merge                       | 4h             | 8h             |
| Additional learning and refinement                                    | 2h             | 6h             |
| **Total**                                                             | **17h**       | **32h**        |


## Additional overheads

In addition to per-deliverable work, there is up-front work that may be paid by each developer:

| Task                                            | Lower Estimate | Upper Estimate |
|-------------------------------------------------|----------------|----------------|
| Become familiar with nbgitpuller architecture   | 4h             | 8h             |
| Set up development environment                  | 2h             | 3h             |
| **Total**                                       | **6h**         | **11h**        |

We will assume that two separate developers incur this cost.

## Intentionally out of scope

For this statement of work, we are leaving the following as intentionally out of scope:

1. Server-side validation of link-generator inputs
2. Advanced client-side validation of link-generator inputs (using `repoproviders` in browser).
3. Specific file scheme `on-success` URLs that are frontend-agnostic[^sub-path].

## Relevant GitHub Issues

Listed below are pertinent GitHub Issues open in the `jupyerhub/nbgitpuller` repository:

- [Documentation of non-git-based jupyter notebook downloading plugins](https://github.com/jupyterhub/nbgitpuller/issues/228)
- [Added non-git source puller functionality](https://github.com/jupyterhub/nbgitpuller/pull/194)
- [Link generator handles non-git source](https://github.com/jupyterhub/nbgitpuller/pull/195)

## People working on this

This project would require capacity from:

1. App Engineer (1 implementation, 1 review)

## Timeline

```{mermaid}
flowchart TD
    A[Add /pull endpoint]
    B[Use new logic in /git-pull]
    C[Upgrade link-generator to use /pull]
    D[Add support for merging non-Git content]
    E[Extend repoproviders support for fetching and resolving non-Git content]
    X[End]
    A --> X
    B --> X
    D --> E --> A
    C --> X
```

[jupyterhub]: https://github.com/jupyterhub/jupyterhub
[kubespawner]: https://github.com/jupyterhub/kubespawner
[nbgitpuller]: https://github.com/jupyterhub/nbgitpuller
[server-sent-events]: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
[repoproviders]: https://github.com/yuvipanda/repoproviders
[pep-440 direct references]: https://peps.python.org/pep-0440/#adding-direct-references
[^sub-path]: In future, it might be nice to support file URLs like `file://clone-path/nb.ipynb` so that we can decouple the frontend from the intent. This would make it easier to generate nbgitpuller URLs where the link-author does not know the details of the target, e.g. if a Jupyter Book allows a user (who is just a `link-consumer`) to paste the URL of a JupyterHub that they have access to.
  It also might make sense to add a counterpart `on-error` that can be used for errors.


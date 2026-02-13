# Authenticated content providers with `nbgitpuller`

## Background

`nbgitpuller` lets authors distribute interactive content to a Jupyter user through clicking a link. This allows users to focus on content without needing to understand Git or any other version control system.

`nbgitpuller` has five functional parts:

1. _Fetch_ content (currently using `git` only)
2. _Resolve conflicts_ between changes in the upstream content and the user's changes (also uses `git` – see 1.)
3. A web UI to show progress of this fetching and conflict resolution
4. A command line interface to automatically do fetching and conflict resolution
5. A web UI to _generate_ links (https://nbgitpuller.readthedocs.io/en/latest/link.html)

There are three different personas that we will refer to in this SOW:

Link-author
: People creating content that they wish to share via an `nbgitpuller` link.

Link-consumer
: People that click an `nbgitpuller` link to fetch and interact with shared content in a Jupyter compute environment.

JupyterHub admin
: An administrator who can configure access to authenticated content through JupyterHub. More generally, they are responsible for managing the hub configuration, including potentially setting up service accounts and OAuth2 apps for service-to-service communication on behalf of the hub identity.

## The Problem

There are providers that require authentication to pull content from them using `nbgitpuller`. This is a valuable feature since some link-authors, such as course instructors, do not wish to make their content public for intellectual property reasons.

## Definition of Done

This SOW specifies an implementation plan that enables `nbgitpuller` to pull from authenticated content providers into a Jupyter environment that can authorise access to content using a

1. **Service token:** authenticate on behalf of the JupyterHub service - limited permissions are granted to JupyterHub to access specific content
2. **User token:** authenticate on behalf of the user – has the same permissions to perform actions as the user and can access all user owned content

## Technical Background

As mentioned in the SOW for [Additional unauthenticated content-providers in nbgitpuller](https://hackmd.io/@agoose77/rydyjJUmee), we can use [`repoproviders`](https://github.com/yuvipanda/repoproviders) as a backend for resolving and fetching and content from

- DOIs hosted on open access repositories such as [Dataverse](https://www.microsoft.com/en-us/power-platform/dataverse), Zenodo, [figshare](https://figshare.com/)
- Git repositories hosted on remote platforms such as GitHub, GitLab, Codeberg, etc.

There are many other remote content providers that link authors may choose to share private content from. Here we consider non-git content providers such as Google Drive, Microsoft OneDrive, or Learning Management Systems such as Canvas or Moodle.

Implementation will focus on extending the [`repoproviders`](https://github.com/yuvipanda/repoproviders) backend to include remote platforms that require authentication via an access token and passed to through the hub.

### 1. Access Google Drive content with a Service Token

In the first instance we prefer to authorise using service tokens and not user tokens in the interests of information security (principle of least privilege). For example, a compromised GitHub user access token with the [`repo` scope](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes) allows attackers to widely spread malicious code to _all_ repositories that a user has access to, including individual and organizational projects. In contrast, a compromised service token acting on behalf of the hub and not a user has a smaller "blast radius", since the service token can be fine-grain scoped for read-only access.

We consider major cloud storage providers such as Google Drive, which provide institutional workspaces for educational settings. A JupyterHub admin can provision a service account with the Google Cloud Platform (GCP) the JupyterHub is hosted on and grant service token scopes that allow read-only permissions. The link author can then share content in a Google Drive folder with the service account. We can then use the service account together with the Google Drive API to pull files from the Google Drive folder with read-only access for link consumers.

### 2. Access Canvas content with a User Token

We have to make careful choices for when a user token must be used when a service token is not available. A service token may be unavailable because the content provider has not provided the concept of service accounts with fine-grained access controls. One such case is Canvas, where [access to the Canvas API using OAuth2](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth#accessing-canvas-api) grants access to user tokens only.

Canvas is the leading LMS of choice for institutions, with over 7000 customers globally. Their system is an [open source](https://github.com/instructure/canvas-lms) web application written in Ruby on Rails and has extensive [Developer Docs](http://developerdocs.instructure.com/).

When an instructor creates a Canvas course, they can upload a set of course [files](https://community.canvaslms.com/t5/Canvas-Basics-Guide/What-are-Files/ta-p/7) for students to view and download. There are also group and personal user file spaces. Since user access to content is managed and isolated in this way, the "blast radius" for a compromised Canvas user token is much smaller than compromising a user token that can access Google Drive files with a much wider security boundary.

Initial development for `nbgitpuller` can start with manually generating a Canvas API access token from Canvas user account settings, however in production we assume the user token is generated upon login and is passed to the compute environment. These access tokens are scoped to the user, and so can perform any action that a user can. We restrict the `repoproviders` code to perform `GET` requests only for read-only interactions.

> [!Note]
> It's also possible to [integrate Canvas with Google Drive](https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-connect-to-Google-Drive-as-a-web-service-in-Canvas/ta-p/617183) and Microsoft OneDrive. However, Canvas Developer Docs do not provide an API for interacting with service integrations.

## Technical Deliverables

### 1. Pull Google Drive content with a Google Service Account Service Token from JupyterHub

1. Create a Google Service Account with the appropriate permissions
   - This must allow the hub to perform actions on behalf of the hub service
   - This must have read-only access to the link author's private content
2. Provision the access tokens from JupyterHub
   - Attach to the hub service
3. Extend `repoproviders` to authenticate against access tokens provided by JupyterHub
   - This must be a separate authentication submodule
   - Logic for `repoproviders` to read access tokens from JupyterHub
   - This must be secure!
4. Create a `GoogleDriveResolver` class for `repoproviders/src/resolvers`
   - Logic to detect Google Drive URLs
   - This includes merge conflict resolution when the source content changes
   - Large datasets are excluded
5. Create a `GoogleDriveFetcher` class for `repoproviders/src/fetchers`
   - This includes logic to fetch authenticated content with read-only access using Google API `GET` requests
   - Ensure that rate limits are not crossed, e.g. when 50 students click on the same `nbgitpuller` in a 5 minute time period
6. Write tests to validate expected behaviour
7. Upstream features to `repoproviders`

```{estimate-table}
-  - Create a Google Service Account with the appropriate permissions
   - 4h
   - 4h
-  - Provision the access tokens from JupyterHub
   - 4h
   - 8h
-  - Extend `repoproviders` to authenticate against access tokens provided by JupyterHub
   - 12h
   - 20h
-  - Create a `GoogleDriveResolver` class for `repoproviders/src/resolvers`
   - 20h
   - 28h
-  - Create a `GoogleDriveFetcher` class for `repoproviders/src/fetchers`
   - 20h
   - 28h
-  - Write tests to validate expected behaviour
   - 12h
   - 16h
-  - Upstream features to `repoproviders`
   - 4h
   - 8h
```

### 2. Pull Canvas content with a User Token from JupyterHub

1. Create a Canvas API user access token
   - Pass token from `auth_state` to singleuser server
   - Store the access token in the JupyterHub environment as an environment variable
2. Authenticate with access token using `repoproviders`
   - This must handle authenticatation in a separate submodule
3. Create a new `CanvasResolver` class for `repoproviders/src/resolvers`
   - This includes user, group and course files
   - This includes merge conflict resolution
4. Create a new `CanvasFetcher` class for `repoproviders/src/fetchers`
   - This includes logic to fetch authenticated content with read-only access with `GET` requests
5. Write tests to validate expected behaviour
6. Upstream features to `repoproviders`

```{estimate-table}
-  - Pass Canvas API user access token to JupyterHub
   -  1h
   -  2h
-  - Authenticate with access token using `repoproviders`
   -  8h
   -  16h
-  - Create a new `CanvasResolver` class for `repoproviders/src/resolvers`
   -  12h
   -  20h
-  - Create a new `CanvasFetcher` class for `repoproviders/src/fetchers`
   -  12h
   -  20h
-  - Write tests to validate expected behaviour
   -  12h
   -  16h
-  - Upstream features to `repoproviders`
   -  4h
   -  8h
```

## Out of Scope

- Separate login flow where authorisation tokens are unavailable from JupyterHub
  - If tokens are not provided by the hub service, then `nbgitpuller` users are required to authorise access to consent through a login flow outside of the hub. This requires introducing a UI framework to handle
    - login flow
    - logic to handle unauthorised hub users
    - logic to handle login failures
    - design UI components for each of the above
    - integration of the above with the backend server
  - Introducing a UI framework to support this is a significant piece of work and requires a separate SOW
- Git remote providers such as GitHub
  - This is a solved problem since [git-credential-helpers](https://github.com/yuvipanda/git-credential-helpers) allows read–only access at a per-hub level
- Other cloud content providers, such as Microsoft OneDrive
  - We provide proof of concept for Google Drive in this SOW to validate potential for extension

## People working on this

This project would require capacity from:

- 2 x App Engineer (implementation and code reviews)

## Timeline

```{estimate-table}
-  - Pull Google Drive content with a Google Service Account Service Token from JupyterHub
   -  76h
   -  116h
-  - Pull Canvas content with a User Token from JupyterHub
   -  49h
   -  82h
```

## References

- https://github.com/yuvipanda/repoproviders
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files
- https://rclone.org/drive/
- https://github.com/instructure/canvas-lms
- https://developerdocs.instructure.com/services/canvas/file.all_resources/files

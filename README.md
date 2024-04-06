# Bosco-Alt (BA)

BA is a utility knife to help manage the complexity that using microservices, which naturally results in a large number of code repositories, brings with it.  Inspired by the Github 'setup', e.g. can a developer run one simple command and get up and running?

> [!NOTE]  
> This project was resurrected from the latest NPM version of bosco (https://npmjs.com/package/bosco) during 2024, as the original repository was made private.

## Get Started

Ensure that you have Node installed using nvm (https://github.com/creationix/nvm), BA uses this to support services running across multiple node versions, then install bosco-alt:

```
npm install bosco-alt -g
ba setup
```

## Configuration

It will ask initially for:

|Configuration|Description|
|:-----------------|-----------|
|Github name|Your username|
|Github Auth Key|A key that gives read access to the repositories in the organization (you can set this up here: https://github.com/blog/1509-personal-api-tokens).|


> [!NOTE]  
> If your organisation has SSO enabled, you need to authorise the token with that before your teams will appear.

This is then saved in a configuration file locally on disk, default is in ~/.bosco/bosco.json, so all subsequent commands use it.

It will then ask for a team to start with, and a folder (referred to below as <folder>) to link the team to (it will create it if it doesn't exist).

After this, do the following:

```
cd <folder>
ba morning
```

At the end of this sequence of steps you will have:

* All of the projects checked out into your project folder.
* Any dependent modules linked between projects (e.g. if one repo is actually a module depended on by another).
* All projects fully npm installed.

### Github enterprise support

In order to use ba with your github enterprise account an additional parameter is avaialable in the BA config file.

````
apiHostname: "your.enterprise.hostname/api/v3"
````


## To join a new team

```
ba team setup
<select team>
<select folder>
cd <folder>
ba morning
```

## Workspaces

BA is built around the idea that you use github teams to manage groups of repositories.  So, when you first run setup, BA will connect to Github, grab all of the teams that you belong to - across all organisations - and cache them locally.

It will then ask you to link a team to a workspace folder - this folder can be anywhere, but it just lets BA know that this is the place where that team lives, this then appears in the output of the command 'ba team ls'.

```
[07:09:26] BA: Initialised using [/Users/cliftonc/.ba/ba.json] in environment [local] with team [service]
[07:09:26] BA: Your current github organisations and teams
[07:09:26] BA:  - cliftonc/southampton-buildings > /Users/cliftonc/work/resources
[07:09:26] BA:  - cliftonc/staff > Not linked
[07:09:26] BA:  - org/cms > Not linked
[07:09:26] BA:  - org/twigkit > Not linked
[07:09:26] BA:  - org/example > Not linked
[07:09:26] BA:  - org/engineering > Not linked
[07:09:26] BA:  - org/profiles > /Users/cliftonc/work/profiles
[07:09:26] BA:  - Calipso/owners > Not linked
[07:09:26] BA:  - org/owners > Not linked
```

To link a workspace, simply:

```
ba team ln cliftonc/example .
```

This will link the team 'cliftonc/example' into the current folder as its workspace.

## Command List

Commands in BA are defined via specific command files within the 'commands' folder: [https://github.com/cliftonc/bosco-alt/tree/master/commands](commands).

To get help on any command just type;

```
ba help clone
```

## Parameters

You can use a number of parameters to control the behaviour of BA.  Parameters are configuration options that can be used across commands.

|parameter|description|default|
|---------|-----------|--------|
|-e, --environment|Environment name|local|
|-b, --build|Build number or tag|default|
|-c, --configFile|Config file|~/.ba/ba.json|
|-p, --configPath|Config path|~/.ba/ba.json|
|-n, --noprompt|Do not prompt for confirmation|false|
|-f, --force|Force over ride of any files|false|
|-s, --service|Inside single service|false|
|--nocache|Ignore local cache for github projects|false|
|--offline|Ignore expired cache of remote service data and use local if available|false|

To see all possible commands and parameters, just type 'ba'.

## Bash completion

To enable bash <tab> completion for BA, add the following line to your ~/.bashrc file:

```
eval "$(ba --completion=bash)"
```

## Key Commands

### Setup

The default command, this sets you up.

```
ba setup
```

This will sync with github, ask you for a default team and workspace folder, clone all the repositories in that team, auto link any dependent modules together (saving lots of 'npm link ../module', and then finally run npm install on all of them.  This literally will save you hours of work on a larger project.

If any repository already exists locally it will skip it.  Typically you only use this command once, and use the other pull, install, morning commands on a daily basis.

## Service Configuration

### ba-service.json

If services want to take part in the static asset pipeline that BA provides, as well as allow ba to start and stop them, then they need a ba-service.json config file.

e.g.

```json
{
    "service": {
        "name": "app-resource",
        "dependsOn": [
            "infra-nginx-gateway",
            "service-page-composer",
            "service-site-assets",
            "service-resource-reviews",
            "service-refdata-api"
        ]
    },
    "tags": ["upload", "resource"],
    "assets": {
        "basePath": "/src/public",
        "js": {
            "bottom": [
                "js/lib/base64.min.js",
                "js/lib/bind.shim.min.js",
                "js/lib/cookies.min.js",
                "js/lib/lean-modal.min.js",
                "js/report-review.js",
                "js/resources.js"
            ],
            "top": [
                "js/event-tracking.js"
            ]
        },
        "css": {}
    }
}
```

## Using BA to start Docker projects

If you add a ba-service.json at the base of your docker projects, you can take advantage of BA knowing how to build, pull and run them as dependencies of your services:

```
{
    "service": {
        "type": "docker",
        "name": "infra-redis",
        "registry": "docker-registry.example.com",
        "username": "username",
        "version": "latest",
        "alwaysPull": true,
        "docker": {
            "HostConfig": {
                "PortBindings": {
                    "6379/tcp": [{
                        "HostIp": "0.0.0.0",
                        "HostPort": "6379"
                    }]
                }
            }
        }
    }
}
```

## Remote dependencies

If you have defined your infrastructure docker files as projects like the one above, pushed to your organisations repo, you can then take advantage of another feature.

You can define a dependency:

```
{
    "service": {
        "name": "app-resource",
        "dependsOn": [
            "infra-nginx-gateway",
            "service-page-composer",
            "infra-redis"
        ]
    }
}
```

And if BA can't find the project in the current team, it will go to your github repository, grab the definition file and run it for you anyway.  Very helpful.

## Docker Compose

You can also define a project as containing a docker-compose definition file:

```
{
    "tags": [],
    "service": {
        "name": "my-containers",
        "type": "docker-compose"
    }
}
```

This expects then a ```docker-compose.yml``` in the root of the project.

## Local Commands

To create your own BA commands for your project (ones that you don't want to submit back to core via a pull request), simply create a 'commands' folder in the root of your BA workspace and add commands to it.  You can use any of the core commands as a starting point.

## Npm Commands

You can create BA commands as npm packages and install it via npm (local or global). These commands must be named bosco-command-*command* such as bosco-command-ports. BA will try to find such commands as long as they match the naming pattern. This was inspired by [Yeoman generators](http://yeoman.io/authoring/)

### Options and Args in new commands

There are two ways of passing input through to a command: options and args.

#### Options (e.g. Command Line Options)

Options are specified via - switches, and are typically applied across more than one command.  For example, -e development.

```
ba -e development s3push
ba -e development cdn minify
```

BA commands can specify one or more options they are interested in and they will be parsed at runtime. You can see an example on the activity command source file.

Within a command these are then accessed via the global BA object, by their long name (see /bin/ba.js).

```
var environment = ba.options.environment;
```

#### Arguments (to specific commands)

Arguments are an array of strings that follow the command.

For example:

```
ba cdn minify
```

In the above command, the command is cdn, the args are: ["minify"]

To use in a command, you typically scan the array for their presence and set a variable (as in most instances they actually represent a Boolean vs a string).

```
var minify = _.contains(args, 'minify');
```

## Troubleshooting

### You switch Node versions

To remove all the node_modules folders in your team's repos:
```
ba clean-modules
```

Then run npm install across them all again:
```
ba install
```

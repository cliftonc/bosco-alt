bosco-ps(3) -- List all of the running Node and Docker processes.
==============================================

## SYNOPSIS

    bosco ps
    bosco ps -r <repoPattern>

## DESCRIPTION

This command shows all of the Node and Docker processes launched via the `bosco run` command.

Node and Docker processes are displayed in two separate lists, they can then be stopped via the `bosco stop` command.

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.

## SEE ALSO

* bosco help run
* bosco help stop
* bosco help tail
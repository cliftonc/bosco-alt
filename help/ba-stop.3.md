bosco-stop(3) -- Stop all of the running Node and Docker processes.
==============================================

## SYNOPSIS

    bosco stop
    bosco stop -r <repoPattern>

## DESCRIPTION

This command stops all of the Node and Docker processes launched via the `bosco run` command.

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.

## SEE ALSO

* bosco help run
* bosco help ps
* bosco help tail
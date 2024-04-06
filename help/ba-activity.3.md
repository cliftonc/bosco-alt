bosco-activity(3) -- Show a rundown of what has been happening across all the repositories.
==============================================

## SYNOPSIS

    bosco activity
    bosco activity -r <repoPattern>
    bosco activity -r <repoPattern> --since <timestamp>

## DESCRIPTION

This command will show a summary of all the commits across all the repositories - used as part of the `morning` command.

## EXAMPLES

    bosco activity -r review --since 2014-09-22T23:36:26-07:00

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.

### -s, --since

* Default: Previous 24 hours
* Type: Timestamp (e.g. 2014-09-22T23:36:26-07:00)

The amount of time to show activity from.

## SEE ALSO

* bosco help morning

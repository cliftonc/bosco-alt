bosco-upstream(3) -- Write out any changes that have occurred in upstream branches
==============================================

## SYNOPSIS

    bosco upstream
    bosco -r <repoPattern> upstream

## DESCRIPTION

This command is used to list out any upstream changes (before a pull, stash etc.) in your repositories.

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.
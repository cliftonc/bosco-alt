bosco-exec(3) -- Run arbitrary commands across all repos
==============================================

## SYNOPSIS

    bosco exec -- <command>
    bosco exec -r <repoPattern> -- <command>

## DESCRIPTION

This command allows you to run any arbitrary command across all repositories.

For example, 'bosco exec -- git status'.

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.

## SEE ALSO

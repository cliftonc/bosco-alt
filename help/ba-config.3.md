bosco-config(3) -- Manage (some of) your configuration.
==============================================

## SYNOPSIS

    bosco config get
    bosco config get <keyName>

    bosco config set <keyName> <keyValue>

## DESCRIPTION

This command can be used to amend your configuration (instead of manually editing the `.bosco/bosco.json` file).

## EXAMPLES

    bosco config get
    bosco config get github

    bosco config get github:user
    bosco config set github:user cliftonc

    bosco config set css:clean:enabled false



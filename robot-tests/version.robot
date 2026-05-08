*** Settings ***
Documentation     Verifies the /api/version endpoint reports a deployed version.
Resource          resources.robot

*** Test Cases ***
Check Version Endpoint
    Open Browser To Version Endpoint
    Page Should Contain      version
    [Teardown]    Close Browser

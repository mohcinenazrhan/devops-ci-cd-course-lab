*** Settings ***
Documentation     Reusable keywords and variables for the Word Cloud app UI tests.
...               These tests run against a remote Selenium grid (defaults set
...               for the Jenkins-in-Docker setup) and verify the deployed app.
Library           SeleniumLibrary

*** Variables ***
${SERVER}         %{ROBOT_TARGET=test_fixture:8888}
${BROWSER}        chrome
${REMOTE URL}     %{ROBOT_REMOTE=http://selenium:4444}
${DELAY}          0
${HOMEPAGE URL}   http://${SERVER}/
${VERSION URL}    http://${SERVER}/api/version
${SAMPLE TEXT}    DevOps continuous integration continuous delivery automation testing pipeline DevOps continuous

*** Keywords ***
Open Browser To Home Page
    Open Browser    ${HOMEPAGE URL}    ${BROWSER}    remote_url=${REMOTE URL}
    Set Selenium Speed    ${DELAY}
    Wait Until Page Contains    Word Cloud Generator    timeout=10s

Open Browser To Version Endpoint
    Open Browser    ${VERSION URL}    ${BROWSER}    remote_url=${REMOTE URL}
    Set Selenium Speed    ${DELAY}

Input Word Cloud Text
    [Arguments]    ${text}
    ${textarea}=    Get WebElement    css:textarea
    Clear Element Text    ${textarea}
    Input Text    css:textarea    ${text}

Submit Word Cloud Text
    Click Button    Generate Word Cloud
    # Wait for the cloud to render (loading state finishes)
    Wait Until Element Is Visible    css:.cloud    timeout=10s

Word Cloud Should Contain
    [Arguments]    ${word}
    Wait Until Page Contains    ${word}    timeout=10s

Cloud Word Count Should Be At Least
    [Arguments]    ${count}
    ${actual}=    Get Element Count    css:.cloud-word
    Should Be True    ${actual} >= ${count}    Expected at least ${count} words, got ${actual}

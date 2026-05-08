*** Settings ***
Documentation     End-to-end UI tests for the React Word Cloud Generator.
Resource          resources.robot
Test Teardown     Close All Browsers

*** Test Cases ***
Page Loads With Title
    Open Browser To Home Page
    Page Should Contain    Word Cloud Generator
    Page Should Contain Element    css:textarea
    Page Should Contain Element    css:button

Submit Generates Word Cloud
    Open Browser To Home Page
    Input Word Cloud Text    What does the fox say? Ring a ding ding ding ding a ding a ding
    Submit Word Cloud Text
    Word Cloud Should Contain    ding

Cloud Has Multiple Distinct Words
    Open Browser To Home Page
    Input Word Cloud Text    ${SAMPLE TEXT}
    Submit Word Cloud Text
    Cloud Word Count Should Be At Least    5

Generated Cloud Words Are Styled
    Open Browser To Home Page
    Input Word Cloud Text    ${SAMPLE TEXT}
    Submit Word Cloud Text
    # Verify each word has the cloud-word class with inline font-size
    ${first_word}=    Get WebElement    css:.cloud-word
    ${font_size}=     Get Element Attribute    ${first_word}    style
    Should Contain    ${font_size}    font-size

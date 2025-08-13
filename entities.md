# AWS Entities Overview

This document details the DynamoDB tables and Cognito User Groups used in the application.

## DynamoDB Tables

| Table Name | Attribute Name | Type | Key Type | Notes |
|---|---|---|---|---|
| IncidentTable | id | String | Primary Key | |
| IncidentTable | userId | String | GSI Partition Key | GSI Name: userId-index |
| FeedbackTable | id | String | Primary Key | |

## Cognito User Groups

- citizen
- cityAuth
- admin
@echo off
"C:\Program Files\Amazon\AWSSAMCLI\bin\sam.cmd" deploy --stack-name airguard --region ap-south-1 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides "Environment=dev WAQIToken=30e8b9afac404fc9ca2ad4821976c1d0c7199abb"

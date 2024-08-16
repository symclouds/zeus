#!/bin/bash

usage() { 
    echo "  ***"
    echo "  *** Usage: $0 [-p <aws profile>]" 
    echo "  ***"
    1>&2; exit 1; 
}
while getopts ":p:" o; do
    case "${o}" in
        p) 
            profile=${OPTARG}
            ;;
        *)
            usage
            ;;
    esac
done

# Make sure the user enters the aws profile to destroy from
if [ -z "${profile}"]; then
    usage
fi

echo ""
echo "****************************************************"
echo "* >>> Starting zeus destruction tool using aws cdk *"
echo "****************************************************"
echo ""
echo ">>> Destroying stack/s ... Please be patient "
T=$(echo y | cdk destroy --all --require-approval never --profile ${profile})
if [ $? -ne 0 ]
then    
    echo ">>> Error: Problem with destroying Zeus from AWS"
    echo $T
    exit 1       
else
    echo ">>> ... Successfully destroyed Zeus resources from AWS"
fi

echo ""
echo "*** Note: If you want to destroy the CloudFormation Stack created by the cdk construct"
echo "          and clean up your enviroment from any artifacts left over from that process,"
echo "          please run the following command from aws cli: "
echo ""
echo "          #aws cloudformation delete-stack --stack-name CDKToolkit --profile <profile>"
echo "          (where profile contains the necessary credentials required to delete the stack)"
echo ""
echo "          The command above does not delete the s3 bucket created by the CDKToolkit Stack,"
echo "          therefore any residual assets and resources that are obsolete may continue to"
echo "          rack up storage costs unnecessarily. If you no longer have a need for these assets,"
echo "          you must explicitly delete them from the console or the cli:"
echo ""
echo "          1. Empty Bucket of objects:"
echo "              aws s3 rm s3://cdk-<string>-assets-<account id>-<region> --recursive --profile <profile>"
echo "          2. Delete Bucket:"
echo "              aws s3 rm s3://cdk-<string>-assets-<account id>-<region> --profile <profile>"
echo "          (where profile contains the necessary credentials required to delete the stack)"
echo ""



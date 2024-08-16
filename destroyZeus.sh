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
T=$(cd cdk && echo y | cdk destroy --all --require-approval never --profile ${profile})
if [ $? -ne 0 ]
then    
    echo ">>> Error: Problem with destroying Zeus from AWS"
    echo $T
    exit 1       
else
    echo ">>> ... Successfully destroyed Zeus resources from AWS"
fi

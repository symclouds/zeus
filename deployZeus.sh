#!/bin/bash

usage() { 
    echo "  ***"
    echo "  *** Usage: $0 [-e <email address> -a <aws account number> -r <aws region> -p <aws profile>]" 
    echo "  ***"
    1>&2; exit 1; 
}
while getopts ":e:a:r:p:" o; do
    case "${o}" in
        e)
            userEmail=${OPTARG}
            ;;
        a)
            account=${OPTARG}
            ;;
        r)
            region=${OPTARG}
            ;;
        p) 
            profile=${OPTARG}
            ;;
        *)
            usage
            ;;
    esac
done

# Make sure the user enters and email address
if [ -z "${userEmail}" ] || [ -z "${account}" ] || [ -z "${region}" ] || [ -z "${profile}" ]; then
    usage
fi

echo ""
echo "***************************************************"
echo "* >>> Starting zeus deployemnt tool using aws cdk *"
echo "***************************************************"
echo ""
echo ">>> Bootstraping the AWS Enviroment ... Please be patient ... "
echo ""
T=$(npm i && echo "{\""email"\":\""${userEmail}\""}"  > cdk.context.json  && cdk bootstrap aws://${account}/${region} --profile ${profile})
if [ $? -ne 0 ]
then    
    echo ">>> Error: Problem with bootstraping to AWS CDK."
    echo $T
    exit 1       
else
    echo ">>> ... Successfully bootstraped to the AWS Environment "
fi

echo ""
echo ">>> Synthesizing AWS CloudFormation Templates for the Zeus"
T=$(cdk synth )
if [ $? -ne 0 ]
then    
    echo ">>> Error: Problem with synthesizing the Cloudformation templates for Zeus"
    echo $T
    exit 1       
else
    echo ">>> ... Successfully synthesized the Cloudformation templates for Zeus"
fi

echo ""
echo ">>> Deploying Zeus to AWS ... Please be patient "
T=$(cdk deploy --all --require-approval never --profile ${profile} )
if [ $? -ne 0 ]
then    
    echo ">>> Error: Problem with deploying Zeus to AWS"
    echo $T
    exit 1       
else
    echo ">>> ... Successfully deployed Zeus to AWS"
fi

echo ""
echo "****** You're all set ******"
echo " >>> Please make note of the <<Outputs>> above because they will be needed for integration"





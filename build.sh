#!/bin/sh
IMAGE_NAME="henryspanka/freeathome-api"
PLATFORMS=(linux/amd64 linux/arm/v7 linux/arm64/v8)

if [ -z "$1" ]
then
    echo "Image tag must be specified!"
    exit 1
fi

BUILD_IMAGES=""

for platform in "${PLATFORMS[@]}"
do
    platformName=${platform#*/}
    platformName=${platformName///}
    echo "Building image with tag ${IMAGE_NAME}:${1}-${platformName}"
    if [ -z "${BUILD_IMAGES}" ]
    then
        BUILD_IMAGES="${IMAGE_NAME}:${1}-${platformName}"
    else
        BUILD_IMAGES="${BUILD_IMAGES} ${IMAGE_NAME}:${1}-${platformName}"
    fi

    docker build --platform="${platform}" --pull -t ${IMAGE_NAME}:"${1}-${platformName}" .
    echo "Pushing to Docker Hub ${IMAGE_NAME}:${1}-${platformName}"
    docker push "${IMAGE_NAME}:${1}-${platformName}"
done

echo "Creating Docker Manifest ${IMAGE_NAME}:${1}"
docker manifest create --amend ${IMAGE_NAME}:"${1}" ${BUILD_IMAGES}

echo "Pushing Manifest to Docker Hub ${IMAGE_NAME}:${1}"
docker manifest push -p "${IMAGE_NAME}:${1}"

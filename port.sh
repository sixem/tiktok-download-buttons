#!/bin/bash

###########################################################
# Ports the Chrome extension to become Firefox compatible.#
###########################################################

TIMESTAMP=$(date +'%d_%m_%Y_%H-%M-%N')
OUTPUT="ff_port-$TIMESTAMP"

declare -a REQUIRES=(
    '48.png'
    '128.png'
    'main.css'
    'main.js'
    'popup.html'
    'popup.css'
    'popup.js'
    'service.js'
)

declare -a HAYSTACK=(
    'chrome.runtime'
    'chrome.storage'
    'chrome.downloads'
    'chrome.tabs'
    'Ask where to save each file before downloading'
    'chrome://settings/downloads'
)

declare -a REPLACE=(
    'browser.runtime'
    'browser.storage'
    'browser.downloads'
    'browser.tabs'
    'Always ask you where to save files'
    'about:preferences'
)

mkdir "$OUTPUT"

cp "./.ff_requires/manifest.json" "./$OUTPUT/manifest.json"

for FILE in "${REQUIRES[@]}"
do
    cp "./$FILE" "./$OUTPUT/$FILE"

    if [[ $FILE == *".js"  ||  $FILE == *".html" ]]
    then
        echo "Processing: $FILE"
        INDEX=0

        for SEARCH in "${HAYSTACK[@]}"
        do
            while IFS= read -r LINE || [ -n "$LINE" ]
            do
                echo "${LINE//$SEARCH/${REPLACE[INDEX]}}"
            done < "./$OUTPUT/$FILE" > "./$OUTPUT/temp_$FILE"

            rm "./$OUTPUT/$FILE"
            mv "./$OUTPUT/temp_$FILE" "./$OUTPUT/$FILE"

            ((INDEX=INDEX+1))
        done
    fi
done
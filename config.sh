SRC="./config.template.yaml"
DST="./config.yaml"
cp $SRC $DST

sed s/{%BASE%}/$ALGOLIA_BASEURL/g -i $DST
sed s/{%URI%}/$ALGOLIA_URI/g -i $DST
sed s/{%INDEX%}/$ALGOLIA_INDEX/g -i $DST
sed s/{%APIKEY%}/$ALGOLIA_APIKEY/g -i $DST
sed s/{%APPID%}/$ALGOLIA_APPID/g -i $DST

npm install -g hugo-algolia2
hugo-algolia2 -s -i $ALGOLIA_INPUT -o $ALGOLIA_OUTPUT --extname $ALGOLIA_EXTNAME
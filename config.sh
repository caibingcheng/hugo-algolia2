SRC="./config.template.yaml"
DST="./config.yaml"
cp $SRC $DST

sed s/{%BASE%}/$1/g -i $DST
sed s/{%URI%}/$2/g -i $DST
sed s/{%INDEX%}/$3/g -i $DST
sed s/{%APIKEY%}/$4/g -i $DST
sed s/{%APPID%}/$5/g -i $DST
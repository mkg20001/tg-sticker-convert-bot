{ stdenv
, lib
, drvSrc ? ./.
, mkNode
, nodejs-16_x
, makeWrapper
, zlib
, libpng
, pkg-config
, optipng
, pngquant
, imagemagick
}:

let
  extraPath = [
    optipng
    pngquant
    imagemagick
  ];
in
mkNode {
  root = drvSrc;
  nodejs = nodejs-16_x;
  production = false;
  packageLock = ./package-lock.json;
} {
  buildInputs = extraPath;

  nativeBuildInputs = [
    makeWrapper
  ];

  postPatch = ''
    export LD=$CC
    export OPTIPNG=DIST=1
    export PNGQUANT_DIST=1
    L=$(mktemp)
    cp $lockfile $L
    lockfile="$L"
    OPTI_RES=$(cat $lockfile | jq -r '.packages["node_modules/optipng-bin"].resolved')
    PNG_RES=$(cat $lockfile | jq -r '.packages["node_modules/pngquant-bin"].resolved')
    sed "s|https://github.com/mkg20001/optipng-bin/releases/download/v7.0.0/optipng-bin-7.0.0.tgz|$OPTI_RES|g" -i $lockfile -i package.json
    sed "s|https://github.com/mkg20001/pngquant-bin/releases/download/v6.0.0/pngquant-bin-6.0.0.tgz|$PNG_RES|g" -i $lockfile -i package.json
  '';

  preFixup = ''
    mod=$out/node_modules

    mkdir -p $mod/pngquant-bin/vendor
    ln -sf ${pngquant}/bin/pngquant $mod/pngquant-bin/vendor/pngquant

    mkdir -p $mod/pngquant-bin/vendor
    ln -sf ${optipng}/bin/optipng $mod/optipng-bin/vendor/optipng

    for bin in $out/bin/*; do
      wrapProgram $bin --prefix PATH : ${lib.makeBinPath extraPath}
    done
  '';
}


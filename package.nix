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


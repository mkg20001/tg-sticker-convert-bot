{ stdenv
, lib
, drvSrc ? ./.
, mkNode
, nodejs-14_x
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
  nodejs = nodejs-14_x;
  production = false;
  packageLock = ./package-lock.json;
} {
  buildInputs = extraPath;

  nativeBuildInputs = [
    makeWrapper
  ];

  postPatch = ''
    export LD=$CC
    
    (while sleep .01; do
      for mod in node_modules $out/node_modules; do
        if [ -e $mod/pngquant-bin ] && [ ! -e $mod/pngquant-bin/vendor/pngquant ]; then
          mkdir -p $mod/pngquant-bin/vendor
          ln -sf ${pngquant}/bin/pngquant $mod/pngquant-bin/vendor/pngquant
        fi

        if [ -e $mod/optipng-bin ] && [ ! -e $mod/optipng-bin/vendor/optipng ]; then
          mkdir -p $mod/pngquant-bin/vendor
          ln -sf ${optipng}/bin/optipng $mod/optipng-bin/vendor/optipng
        fi
      done
    done) & p=$!
  '';

  preFixup = ''
    for bin in $out/bin/*; do
      wrapProgram $bin --prefix PATH : ${lib.makeBinPath extraPath}
    done
  '';
}


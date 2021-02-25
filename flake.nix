{
  description = "tg-sticker-convert-bot";

  inputs = {
    nix-node-package.url = "github:mkg20001/nix-node-package/master";
  };

  outputs = { self, nixpkgs, nix-node-package }:

    let
      supportedSystems = [ "x86_64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs supportedSystems (system: f system);
    in

    {
      overlay = final: prev: {
        tg-sticker-convert-bot = prev.callPackage ./package.nix {
          mkNode = nix-node-package.lib.nix-node-package prev;
        };
      };

      defaultPackage = forAllSystems (system: (import nixpkgs {
        inherit system;
        overlays = [ self.overlay ];
      }).tg-sticker-convert-bot);

    };
}


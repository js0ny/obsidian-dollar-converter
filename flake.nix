{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          ciDeps = with pkgs; [
            nodejs
            pnpm
          ];
          devDeps = with pkgs; [ vtsls ];
        in
        {
          default = pkgs.mkShell {
            buildInputs = ciDeps ++ devDeps;
            shellHook = /* bash */ "";
          };
        }
      );
    };
}

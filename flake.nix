{
  description = "2i2c SOW Repository";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.nixpkgs.follows = "nixpkgs"; # keep nixvim nixpkgs consistent with nixpkgs
    };
    mystmd = {
      url = "git+https://gist.github.com/73cf022e5d9f8ce99d8e9d5bff10e5d9";
      inputs.nixpkgs.follows = "nixpkgs"; # keep nixvim nixpkgs consistent with nixpkgs
    };
  };
  outputs = {
    self,
    nixpkgs,
    flake-utils,
    mystmd,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
      };
      packages = [mystmd.packages.${system}.myst];
    in {
      devShell = pkgs.mkShell {
        inherit packages;
      };
    });
}

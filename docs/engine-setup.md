# Engine and web validation setup

Keep the engine source, SDKs and build outputs outside this game repository. The installed
Game Engine CLI/native hosts can stay in use; select the separately built wasm host through
the supported `GAMEENGINE_HOST_WEB` override. Physical-phone testing is outside this workflow.

## Pinned inputs

| Input | Verified version/revision |
|---|---|
| Official engine source | `git@github.com:tactilegames/game-engine.git` |
| Engine tag/commit | `v0.1.21`, `56980953204edc42f6e7c8cd7dc5c39500f2c710` |
| Rust | `1.94.1`, `e408947bfd200af42db322daf0fadfe7e26d3bd1` |
| Rust target | `wasm32-unknown-emscripten` |
| pnpm | `10.33.0`, matching the engine packageManager |
| Emscripten | `6.0.10`, compiler `d6c521a7f05449857c76bd99e396895583cf2083` |
| emsdk release hash | `666337b525e673e769121856d175f6f52b8ead64` |
| Official emsdk source | `https://github.com/emscripten-core/emsdk.git`, checkout `d7b4130688bfa348392b921ab04015aa15c4f154` |

Use Node 22+ and Python 3.10+ for bootstrap. emsdk supplies its own Python/Node after activation.
The verified machine also had CMake 4.4.5 and Ninja 1.13.2. The source repository URL was
confirmed through the authenticated Tactile organization repository listing.

## Build the wasm test host

Set these placeholders to absolute paths on the current machine; the source and SDK directories
must be outside the game repository. Install Rust through official rustup if it is absent.

```sh
export OUTRUN_ENGINE_SOURCE=/absolute/path/to/game-engine-source
export OUTRUN_EMSDK=/absolute/path/to/emsdk
export OUTRUN_GAME_ROOT=/absolute/path/to/poc-out-run
git clone git@github.com:tactilegames/game-engine.git "$OUTRUN_ENGINE_SOURCE"
git -C "$OUTRUN_ENGINE_SOURCE" checkout --detach v0.1.21
git clone https://github.com/emscripten-core/emsdk.git "$OUTRUN_EMSDK"
git -C "$OUTRUN_EMSDK" checkout d7b4130688bfa348392b921ab04015aa15c4f154
rustup toolchain install 1.94.1 --profile minimal
rustup target add --toolchain 1.94.1 wasm32-unknown-emscripten
"$OUTRUN_EMSDK/emsdk" install 6.0.10
"$OUTRUN_EMSDK/emsdk" activate 6.0.10
export RUSTUP_TOOLCHAIN=1.94.1
export GAMEENGINE_EMSDK="$OUTRUN_EMSDK"
source "$OUTRUN_EMSDK/emsdk_env.sh"
cd "$OUTRUN_ENGINE_SOURCE"
pnpm install --frozen-lockfile
pnpm wasm:host
export GAMEENGINE_HOST_WEB="$OUTRUN_ENGINE_SOURCE/target/wasm32-unknown-emscripten/debug/gameengine-host.js"
cd "$OUTRUN_GAME_ROOT"
npm run test:web
```

If the system Python is too old, select a Python 3.10+ binary through `EMSDK_PYTHON` before the
emsdk install commands. Sourcing emsdk_env.sh then selects its bundled Python; do not assume
the macOS/Xcode `python3` is new enough. The wasm host needs its sibling `gameengine_host.wasm`.
No dynamic-library-loader override is needed for that host. A missing host remains a failing lane.

## Export and inspect a real browser game

The installed CLI lacks engine sources and refuses real web compilation. Use the pinned source
CLI for exports, with its officially supported native-tool overrides. `OUTRUN_INSTALLED_ENGINE`
is the installed engine resources directory; choose an export directory outside the repositories.

```sh
export OUTRUN_INSTALLED_ENGINE=/absolute/path/to/installed/engine
export OUTRUN_WEB_EXPORT=/absolute/path/to/scratch/outrun-web
export GAMEENGINE_COOK="$OUTRUN_INSTALLED_ENGINE/target/release/gameengine-cook"
export GAMEENGINE_HOST="$OUTRUN_INSTALLED_ENGINE/target/release/gameengine-host"
export GAMEENGINE_HOST_HERMES="$OUTRUN_INSTALLED_ENGINE/target/hermes/release/gameengine-host"
export GAMEENGINE_HERMESC="$OUTRUN_INSTALLED_ENGINE/third_party/hermes/build/bin/hermesc"
node "$OUTRUN_ENGINE_SOURCE/tools/cli/bin/gameengine.mjs" build web --config probe --project "$OUTRUN_GAME_ROOT/outrun" --out "$OUTRUN_WEB_EXPORT" --json
python3 -m http.server 8080 --directory "$OUTRUN_WEB_EXPORT/site"
```

Open localhost:8080 in a headed Chromium browser with native WebGPU, activate Start game,
inspect a nonblank game frame, then resize between the landscape samples. For browser automation
on this Mac, use headed Chromium with `--enable-unsafe-webgpu`. Check engine/page console errors
and actual `gameengineProbe.state().frames` advancement as well as simulation steps. Stop the
scratch server/browser after inspection. A successful export or wasm hash alone proves no pixels.

Headless-shell native-GPU mode on this Mac produced black frames and an InvalidTexture error
on resize; SwiftShader mode provided no adapter (`E_WEB_ADAPTER`). Those attempts failed and
were retained as negative evidence. The headed native-WebGPU run passed without changing
game content or suppressing errors. Do not bless blank screenshots or skip console failures.

## Bootstrap evidence

The automated PR gate passed on game commit `d8de56feb4f9f6274099104610af07f7a41453d0`: generated
bindings, formatting, types/validation/cook/startup smoke, V8/Hermes parity, mobile/compat T1,
cooked T0 and V8/web parity. Web parity executed four test instances in 1.18 seconds. The cold
wasm-host build took 1m45s; repeat focused tests use that cached host.

A real probe export (`dryRun:false`) contained 266366 cooked-content bytes and 25744899 total
bytes. Headed Chromium 153.0.8010.12 rendered the starter bubbles at 1280x720 and 852x393 with
zero engine/page errors, advancing rendered frames 175→181 and simulation steps 180→186 across
resize. Visually inspected PNGs contained 14032 and 4499 foreground pixels respectively,
confirming nonblank content. These are starter/desktop/browser results, not OutRun gameplay,
safe-area, lifecycle/storage or physical-hardware performance coverage. Refresh candidate
evidence after implementation changes; these historical results do not certify future heads.

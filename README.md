# Controller-Tester

Standalone live view for a DualShock 4 or DualSense, built to sit next to [consolecheat.com](https://consolecheat.com). German is the primary language. The same language list, light and dark theme, self-hosted fonts, footer, Impressum, and Datenschutz as the Title-ID-Finder are included. There is no Webmail link.

No account, no tracking, nothing uploaded. Button, stick, and trigger readings stay in the browser tab. Language and theme are the only things kept locally (`consolecheat-lang`, `consolecheat-theme`), same keys as the hub. Fonts are self-hosted, so the page does not call Google or any other third party while it loads. The Impressum fields are placeholders until the operator fills them in.

Expected site: <https://robfreak.github.io/consolecheat-ex3/>

Inoffiziell. Nicht von Sony.

## What it does

Plug the controller in over USB or Bluetooth, then press any button. The page reads the [Gamepad API](https://w3c.github.io/gamepad/) and shows:

- Every button, with PlayStation names, on a layout that lights up. A detected DualShock 4 uses that body’s left side (D-pad above the stick). DualSense, the test controller, and other pads use the DualSense arrangement.
- Both sticks, with the live position, a solid 10% deadzone circle, a dashed circle at the 8% drift line, and the resting offset as numbers.
- Drift when that resting offset is above 8%. A hard push does not count as the rest point. The same function handles a real pad and the simulated one.
- L2 and R2 as analog bars.
- A short vibration, when `vibrationActuator` (Chrome, Edge) or `hapticActuators` (some Firefox builds) is available.

If the browser does not report `mapping: "standard"`, a Sony pad is read with the raw HID order used by Chromium (`MapperDualshock4` / `MapperDualSense`). The mapping control can force Standard, Sony HID, or the Linux hid-sony / hid-playstation order (Sony kernel).

## Test mode

No controller is required.

- Open <https://robfreak.github.io/consolecheat-ex3/?demo=1>, or press **Testmodus** on the page. The address gains `?demo=1`. Hardware is ignored until Testmodus is turned off.
- Keyboard: left stick `W A S D`, right stick arrow keys, triangle `I`, square `J`, cross `K`, circle `L`, L1 `Q`, R1 `E`, hold L2 `1`, hold R2 `2`, Share/Create `3`, Options `4`, L3 `Z`, R3 `X`, D-pad `T F G H`, PS `P`, touchpad space.
- Mouse: drag inside a stick field, or hold a button on the picture or in the list.
- **Stick-Drift simulieren** eases the left stick to a rest offset above the drift line and leaves the right stick under it. The picture and the drift flag use the same code as a physical pad.

```bash
npm test        # drift detection and input mapping
npm run dev     # http://127.0.0.1:5173/consolecheat-ex3/?demo=1
npm run build   # typecheck and Vite build, base /consolecheat-ex3/
```

## Browser support

- Desktop Chrome, Edge, and Firefox expose DualShock 4 and DualSense over USB and Bluetooth. The pad stays hidden until a button is pressed.
- With `mapping: "standard"`, button 0 is Cross, 1 Circle, 2 Square, 3 Triangle, 6 and 7 are analog L2/R2, 16 is PS, and Chromium puts the touchpad click on 17.
- macOS Safari often shows the pad. The touchpad button is frequently unmapped, and vibration is usually missing. iOS Safari is not a reliable target for these controllers.
- `vibrationActuator.playEffect("dual-rumble")` works in desktop Chromium. Firefox may expose `hapticActuators[0].pulse` instead. The page tries both. Adaptive triggers on a DualSense are not part of this API and are not tested here.
- The page must be a secure context (`https`, or `localhost`). GitHub Pages is https.
- On Linux, Bluetooth needs the kernel to expose a joystick (`hid-playstation` on 5.12+, or `hid-sony`). If the face buttons are rotated, switch mapping to Sony HID or Sony kernel.

## GitHub Pages

`.github/workflows/pages.yml` runs the tests and the production build on pull requests and on every push. A push to `main` also pushes `dist/` to the orphan branch `gh-pages` (`peaceiris/actions-gh-pages`, Jekyll off).

Vite `base` is `/consolecheat-ex3/`, which matches a project site at `https://robfreak.github.io/consolecheat-ex3/`.

The Actions token can update `gh-pages` only when Actions has write permission. It often cannot turn Pages on. If the URL is not live, the repo owner does this once:

1. **Settings → Actions → General → Workflow permissions → Read and write permissions.** Save.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
3. **Branch: `gh-pages`, folder: `/ (root)`.** Save.
4. Merge to `main`. The workflow fills `gh-pages`. The first deploy can take a minute.

Replace the Impressum placeholders with the operator’s real details before treating that page as a legal notice. No name or address was invented.

#!/usr/bin/env sh
# Deterministic web shims for react-native@0.73.2 so `expo export:web`
# (Webpack) succeeds. RN 0.73.2 ships several internal modules WITHOUT a
# `.web.js` variant that ReactNativePrivateInterface / StyleSheet / etc.
# require on web.
#
# Discovery (re-run if react-native is upgraded):
#   node scripts/rn-web-shims.js   # self-healing discoverer
#
# These shims are applied only for the `web` platform (the `.web.js`
# extension), so native Android/iOS builds are unaffected.
set -eu

RN="node_modules/react-native"
emit() {
  # $1 = relative path, $2.. = content lines
  rel="$RN/$1"
  mkdir -p "$(dirname "$rel")"
  [ -f "$rel" ] || printf '%s\n' "$2" > "$rel"
  echo "  + $rel"
}

echo "Applying RN 0.73.2 web shims..."
emit "Libraries/Utilities/Platform.web.js" \
"/** Web Platform shim for RN 0.73.2 (delegates to react-native-web). */
module.exports = require('react-native-web/dist/exports/Platform');"

emit "Libraries/Utilities/BackHandler.web.js" \
"/** web no-op (react-native-web handles BackHandler). */
module.exports = {};"

emit "Libraries/StyleSheet/PlatformColorValueTypes.web.js" \
"/** web no-op (react-native-web handles color value types). */
module.exports = {};"

emit "Libraries/Alert/RCTAlertManager.web.js" \
"/** web no-op (react-native-web handles Alert). */
module.exports = {};"

emit "Libraries/Network/RCTNetworking.web.js" \
"/** web no-op (react-native-web handles Networking). */
module.exports = {};"

emit "Libraries/NativeComponent/BaseViewConfig.web.js" \
"/** web no-op (react-native-web handles base view config). */
module.exports = {};"

emit "Libraries/Components/AccessibilityInfo/legacySendAccessibilityEvent.web.js" \
"/** web no-op (react-native-web handles AccessibilityInfo). */
module.exports = function legacySendAccessibilityEvent() {};"

echo "Shims ready."

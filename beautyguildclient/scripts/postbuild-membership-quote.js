// The standalone "Get a membership quote" mini-app (public/membership-quote.js/.css) has
// to run WITHOUT the main React app mounting into #root when it's rendering its own public
// (?membershipQuote=1) or demo (?membershipMock=1) page - otherwise React and the mini-app
// would both try to own the same DOM node. Its own <script>/<link> tags already live in
// public/index.html (so the dev server also gets the mini-app); this only rewrites the
// unconditional main.js <script> tag react-scripts injects into a conditional loader that
// skips it for those two query params. In every other case, main.js still loads exactly
// as before.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'build', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const scriptTagMatch = html.match(/<script defer="defer" src="([^"]*\/static\/js\/main\.[^"]+\.js)"><\/script>/);
if (!scriptTagMatch) {
  console.log('postbuild-membership-quote: main.js script tag not found - skipping (index.html unchanged)');
  process.exit(0);
}
const [fullTag, mainJsSrc] = scriptTagMatch;

const conditionalLoader = `<script>var routeParams=new URLSearchParams(location.search);if(routeParams.get("membershipMock")!=="1"&&routeParams.get("membershipQuote")!=="1"){var appScript=document.createElement("script");appScript.src="${mainJsSrc}";appScript.defer=true;document.head.appendChild(appScript)}</script>`;

html = html.replace(fullTag, conditionalLoader);

fs.writeFileSync(indexPath, html);
console.log('postbuild-membership-quote: index.html updated with the conditional main.js loader');

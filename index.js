const { Cluster } = require('puppeteer-cluster');
const Sitemapper = require('sitemapper');
const percySnapshot = require('./node_modules/@percy/script/snapshot.js');
const branch = require('git-branch');

let origin = 'https://www.loganbussey.com';

(async () => {
  // Create a cluster
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 4,
  });

  // Get the current git branch
  const gitbranch = await branch();
  if (gitbranch !== 'master') {
    origin = `https://${gitbranch}.loganbussey.com`
  }

  // Define the task to run on each URL
  await cluster.task(async ({ page, data: url }) => {
    const u = new URL(url);
    const name = u.pathname.slice(1,-1);

    await retry(() => page.goto(url));
    // await autoScroll(page);
    await percySnapshot(page, name || 'homepage');
  });

  // Grab the Sitemap
  const mapper = new Sitemapper();
  const sitemap = await mapper.fetch(`${origin}/sitemap.xml`);

  console.log(`Snapshotting ${sitemap.sites.length} URLs…`);

  // Add pages to cluster queue
  for (var i = 0; i < sitemap.sites.length; i++) {
    cluster.queue(sitemap.sites[i]);
  }

  await cluster.idle();
  await cluster.close();
})();

async function autoScroll(page){
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let lastScrollTop = document.scrollingElement.scrollTop;
      const scroll = () => {
        document.scrollingElement.scrollTop += 100;
        if (document.scrollingElement.scrollTop !== lastScrollTop) {
          lastScrollTop = document.scrollingElement.scrollTop;
          requestAnimationFrame(scroll);
        } else {
          resolve();
        }
      };
      scroll();
    });
  });
};

async function retry(promiseFactory, retryCount = 10) {
  try {
    return await promiseFactory();
  } catch (error) {
    if (retryCount <= 0) {
      throw error;
    }
    return await retry(promiseFactory, retryCount - 1);
  }
};

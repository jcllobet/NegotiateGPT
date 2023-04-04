import { Builder, By, until } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';

async function getAllVisibleText(url: string): Promise<string> {
  // Set up Chrome options
  const chromeOptions = new chrome.Options();
  // chromeOptions.addArguments("--headless");
  chromeOptions.addArguments('--no-sandbox');
  chromeOptions.addArguments('--disable-dev-shm-usage');

  // Set up the driver with the options
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();

  try {
    // Navigate to the URL
    await driver.get(url);

    // Get all visible text from the LinkedIn profile page
    const visibleText = await driver.executeScript<string[]>(`
        const node = document.querySelector("body");
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (!/^\s*$/.test(node.nodeValue)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        }, false);

        const textContents = [];
        while (walker.nextNode()) {
            textContents.push(walker.currentNode.nodeValue.trim());
        }
        return textContents;
    `);

    return visibleText.join('\n');
  } catch (e) {
    console.error('Error:', e);
    return '';
  } finally {
    driver.quit();
  }
}

// Example usage:
getAllVisibleText('https://www.linkedin.com/in/rajakulasekharr/').then((text) =>
  console.log(text),
);

export { getAllVisibleText };

// module.exports = {
//   getAllVisibleText: getAllVisibleText(
//     'https://www.linkedin.com/in/rajakulasekharr/',
//   ).then((text) => console.log(text)),
// };

import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { config } from 'dotenv';
import { OpenAI } from 'openai';

config();
const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scrapeWebsite(url) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const content = await page.evaluate(() => {
    return {
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText),
      text: document.body.innerText.slice(0, 3000)
    };
  });

  await browser.close();
  return content;
}

async function getAudit(data, url) {
  const prompt = `
You're a professional web consultant. Based on the following scraped data from ${url}, create a detailed audit report:

Title: ${data.title}
Headings: ${data.headings.join(" | ")}
Visible Text Sample: ${data.text}

Include:
1. Homepage UX
2. Navigation
3. Mobile Optimization
4. Content/CRO
5. SEO
6. Speed/Performance
7. Final Recommendations
`;

  const result = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
  });

  return result.choices[0].message.content.trim();
}

app.post('/generate-report', async (req, res) => {
  const { url } = req.body;
  try {
    const scraped = await scrapeWebsite(url);
    const report = await getAudit(scraped, url);
    res.json({ success: true, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error generating report' });
  }
});

app.listen(process.env.PORT || 4000, () => console.log('🚀 Server running'));

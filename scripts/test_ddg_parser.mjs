async function test() {
  const query = 'cafes in Greater Noida';
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const html = await res.text();
  
  // Extract results
  const resultBlocks = html.split(/<div[^>]*class="[^"]*result\s+results_links[^"]*"[^>]*>/i).slice(1);
  console.log(`Found ${resultBlocks.length} result blocks`);

  for (let i = 0; i < Math.min(resultBlocks.length, 5); i++) {
    const block = resultBlocks[i];
    const titleMatch = block.match(/<a[^>]*class="result__url"[^>]*href="([^"]*)"/i) || block.match(/<a[^>]*class="result__snippet"[^>]*href="([^"]*)"/i);
    const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

    const title = linkMatch ? linkMatch[2].replace(/<[^>]+>/g, '').trim() : '';
    let link = linkMatch ? linkMatch[1] : '';
    // DDG redirect unpack
    if (link.includes('uddg=')) {
      try {
        const u = new URL(link, 'https://html.duckduckgo.com');
        link = decodeURIComponent(u.searchParams.get('uddg') || link);
      } catch {}
    }
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    console.log(`\nResult ${i + 1}:`);
    console.log(`  Title: ${title}`);
    console.log(`  URL: ${link}`);
    console.log(`  Snippet: ${snippet.slice(0, 100)}...`);
  }
}

test();

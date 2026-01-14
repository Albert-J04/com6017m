export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
  
      //  Simple API to fetch data from ThingSpeak
      if (url.pathname === "/api/data") {
        try {
          // check secrets
          if (!env.CHANNEL_ID || !env.READ_KEY) {
            return new Response(JSON.stringify({ error: "No secrets" }), { status: 500 });
          }
  
          // fetch from thingspeak
          const tsUrl = `https://api.thingspeak.com/channels/${env.CHANNEL_ID}/feeds.json?api_key=${env.READ_KEY}&results=5`;
          const response = await fetch(tsUrl);
          
          if (!response.ok) {
             return new Response(JSON.stringify({ error: "ThingSpeak Error" }), { status: 500 });
          }
  
          const data = await response.json();
  
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" }
          });
  
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      }
  
      // Serves website when you visit URL
      return new Response(HTML_TEMPLATE, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    },
  };
  
  // website code (gross way of doing it)
  const HTML_TEMPLATE = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Monitor</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
          body { background-color: #121212; color: #ffffff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; margin: 0; }
          
          /* status card */
          .card { 
              background: #1e1e1e; 
              padding: 40px; 
              border-radius: 16px; 
              text-align: center; 
              border: 2px solid #333; 
              width: 90%; 
              max-width: 400px; 
              margin-top: 20px;
              transition: all 0.3s ease;
          }
  
          .icon { font-size: 80px; margin-bottom: 20px; color: #555; }
          .status { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .meta { color: #888; font-size: 14px; }
          
          /* log table */
          table { margin-top: 30px; width: 100%; max-width: 600px; border-collapse: collapse; background: #1e1e1e; border-radius: 8px; overflow: hidden; }
          th, td { padding: 15px; text-align: left; border-bottom: 1px solid #333; }
          th { background: #252525; color: #aaa; font-size: 12px; text-transform: uppercase; }
          
          /* colours */
          .safe { border-color: #2ecc71; box-shadow: 0 0 20px rgba(46,204,113,0.2); }
          .danger { border-color: #e74c3c; box-shadow: 0 0 40px rgba(231,76,60,0.4);  }
          .warn { border-color: #f1c40f; }
          .info { border-color: #3498db; }
  
          .c-safe { color: #2ecc71; }
          .c-danger { color: #e74c3c; }
          .c-warn { color: #f1c40f; }
          .c-info { color: #3498db; }
      </style>
  </head>
  <body>
  
      <h1 style="letter-spacing: 2px;">DOORBELL <i class="fa-solid fa-shield-halved"></i></h1>
  
      <div id="ui-card" class="card">
          <div id="ui-icon" class="icon"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
          <div id="ui-text" class="status">Connecting...</div>
          <div id="ui-time" class="meta">please wait...</div>
      </div>
  
      <table id="log-table" style="display:none;">
          <thead><tr><th>Time</th><th>Event</th></tr></thead>
          <tbody id="log-body"></tbody>
      </table>
  
      <script>
          async function refresh() {
              try {
                  // fetch data from api
                  const res = await fetch('/api/data');
                  const data = await res.json();
                  
                  // error
                  if (data.error) {
                      document.getElementById('ui-text').innerText = data.error;
                      return;
                  }
                  if (!data.feeds || data.feeds.length === 0) {
                      document.getElementById('ui-text').innerText = "No data";
                      return;
                  }
  
                  // Get Latest Data
                  const latest = data.feeds[data.feeds.length - 1];
                  const code = parseInt(latest.field1);
                  const time = new Date(latest.created_at).toLocaleTimeString();
  
                  // Update UI
                  const card = document.getElementById('ui-card');
                  const icon = document.getElementById('ui-icon');
                  const text = document.getElementById('ui-text');
                  const timeLabel = document.getElementById('ui-time');
                  const table = document.getElementById('log-table');
  
                  // Reveal table once data loads
                  table.style.display = 'table';
                  card.className = 'card'; // Reset classes
  
                  // LOGIC MAP
                  if (code == 0) {
                      card.classList.add('safe');
                      icon.innerHTML = '<i class="fa-solid fa-check-circle c-safe"></i>';
                      text.innerHTML = '<span class="c-safe">SAFE</span>';
                  } else if (code < 10) {
                      card.classList.add('danger');
                      icon.innerHTML = '<i class="fa-solid fa-door-closed c-danger"></i>';
                      text.innerHTML = '<span class="c-danger">' + code + ' person(s) at the door</span>';
                  } else if (code == 50) {
                      card.classList.add('warn');
                      icon.innerHTML = '<i class="fa-solid fa-dog c-warn"></i>';
                      text.innerHTML = '<span class="c-warn">DOG DETECTED</span>';
                  } else if (code == 60) {
                      card.classList.add('warn');
                      icon.innerHTML = '<i class="fa-solid fa-cat c-warn"></i>';
                      text.innerHTML = '<span class="c-warn">CAT DETECTED</span>';
                  } else if (code == 70) {
                      card.classList.add('info');
                      icon.innerHTML = '<i class="fa-solid fa-car c-info"></i>';
                      text.innerHTML = '<span class="c-info">CAR DETECTED</span>';
                  }
  
                  timeLabel.innerText = "Last Update: " + time;
  
                  // Update Table
                  const tbody = document.getElementById('log-body');
                  // Reset Table
                  tbody.innerHTML = '';
                  [...data.feeds].reverse().forEach(f => {
                      let type = "Unknown";
                      let rawType = parseInt(f.field1);
                      if(rawType==0) type="All Clear";
                      else if(rawType<10) type="Person ("+rawType+")";
                      else if(rawType==50) type="Dog";
                      else if(rawType==60) type="Cat";
                      else if(rawType==70) type="Car";
                      
                      tbody.innerHTML += '<tr><td>'+new Date(f.created_at).toLocaleTimeString()+'</td><td>'+type+'</td></tr>';
                  });
  
              } catch (e) {
                  console.error(e);
                  document.getElementById('ui-text').innerText = "Connection Failed";
              }
          }
  
          // Run immediately and then every 3s
          refresh();
          setInterval(refresh, 3000);
      </script>
  </body>
  </html>
  `;
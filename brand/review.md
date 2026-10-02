1. **Coin page opens with a broken product area.**  
   Change the large DexScreener iframe showing **“No data here”** to a working first-party chart. Replace the whole `Price` panel with **“Creator fees over time”** using TAPE snapshots. For HIVE, render the existing 27.9 ETH point as a line/step chart; if there is only one point, show the centered state: **“1 snapshot recorded — trend starts after the next refresh.”** Do not show an empty DexScreener embed in the first view.

2. **The coin page does not show the actual token price in the decision area.**  
   Add a stat tile above or inside the right metrics card: **PRICE** → live USD token price, formatted as `$0.000000` for small caps, with **24H** beside it as `+30.7%` / `-x.x%`. Move this before **FEES 1H**. Traders need price before fee interpretation.

3. **“—” is unexplained and looks like missing data.**  
   Replace every standalone dash in metric cells with explicit copy:  
   - Home table `FEES / DAY` value: change `—` to **“Not enough data”** in muted text.  
   - Coin card `FEES / DAY`: change `—` to **“Not measurable yet”**.  
   - Subtext: change truncated `measured once snapshots span a...` to **“Needs snapshots at least 24h apart.”**

4. **The homepage headline is too vague for a one-second crypto board.**  
   Change hero H1 from **“See what the chain is paying for.”** to **“Robinhood Chain creator fee leaderboard.”**  
   Keep the subhead, but change it to: **“Live creator fees, market caps, ages and themes for launchpad coins, ranked by what they earn.”**

5. **Yellow row fills overpower the table and look like selected rows.**  
   Change hot row background from pale yellow to **`#FFFFFF`**. Keep only:  
   - left row border: **4px solid `#F2B705`**  
   - `HOT` pill background: **`#F2B705`**, text **`#11110F`**  
   The accent should mark status, not flood five full rows.

6. **The fee chart at the bottom looks unfinished: flat yellow block, no scale, no readable result.**  
   Change the yellow filled rectangle to:  
   - line: **2px `#F2B705`**  
   - area fill: **`rgba(242,183,5,0.14)`**  
   - add left y-axis labels: **`0 ETH`** and **`27.9 ETH`**  
   - add empty-state copy when flat: **“No movement yet between snapshots.”**

7. **Table link buttons are cryptic.**  
   Change `LINKS` column header to **`OPEN`**.  
   Change circular `P` buttons to text buttons: **`Pons ↗`**.  
   Change circular `X` to **`X ↗`**.  
   Minimum button width: **64px** for Pons, **44px** for X.

8. **The coin page metric card truncates important helper text.**  
   Increase the right metric card column width or reduce copy so no line clips. Exact text changes:  
   - `FEES 1H` subtext: **“Over 6 min of snapshots.”**  
   - `LIFETIME / DAY` subtext: **“Total fees ÷ age.”**  
   - `MARKET CAP` subtext: **“Launchpad · updated 5 min ago.”**
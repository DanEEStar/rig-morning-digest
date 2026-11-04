import type { Night } from '../digest/types.js';

// Missing data renders as —, never as an empty cell (styleguide). A retry run of 3 or more and
// any fail are marked (plan.md § 2a).
const dash = '—';

export function DigestTable({ night }: { night: Night }) {
  return (
    <>
      <h1>digest</h1>
      <p class="mute">{night.night}</p>
      {night.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>error</th>
              <th>first</th>
              <th>last seen</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
                <td class={row.lastError === null ? undefined : 'warn'}>{row.lastError ?? dash}</td>
                <td>{row.first}</td>
                <td>{row.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} did not parse
        </p>
      ) : null}
    </>
  );
}

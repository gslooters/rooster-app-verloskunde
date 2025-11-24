// PDF API cache-bust DRAAD48-B fix - build trigger
export default function handler(req, res) {
  res.status(200).json({ now: Date.now(), trigger: Math.random() });
}

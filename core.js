(function (root) {
  "use strict";
  function number(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw Error("Valor inválido: " + v);
    return n;
  }
  function parse(text) {
    text = text.replace(/^\uFEFF/, "").trim();
    let drops = [],
      supplies = [];
    if (text.startsWith("{")) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.Drops) || !Array.isArray(data.Supplies))
        throw Error("JSON deve conter Drops e Supplies.");
      drops = data.Drops;
      supplies = data.Supplies;
    } else {
      let section = "",
        headers = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) {
          headers = [];
          continue;
        }
        const cells = line.split("\t");
        if (cells.length === 1) {
          section = cells[0].trim();
          headers = [];
          continue;
        }
        if (!headers.length) {
          headers = cells;
          continue;
        }
        if (!["Saques", "Suprimentos"].includes(section)) continue;
        const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
        const out = {
          Item: row.Item,
          Player: row.Jogador,
          Count: row.Contagem,
          "Unit price": row["Preço unitário"],
          Ignored: row.Ignoradas,
        };
        (section === "Saques" ? drops : supplies).push(out);
      }
    }
    const normalize = (rows) =>
      rows.map((r) => {
        if (!r.Item || !r.Player) throw Error("Item ou jogador ausente.");
        const count = number(r.Count);
        if (!Number.isSafeInteger(count)) throw Error("Quantidade deve ser inteira.");
        return {
          item: String(r.Item),
          player: String(r.Player),
          count,
          price: number(r["Unit price"]),
          ignored:
            r.Ignored === true || ["true", "sim", "yes"].includes(String(r.Ignored).toLowerCase()),
        };
      });
    const result = { drops: normalize(drops), supplies: normalize(supplies) };
    if (!result.drops.length && !result.supplies.length)
      throw Error("Nenhum saque ou suprimento encontrado.");
    return result;
  }
  function cents(n) {
    const v = Math.round(n * 100);
    if (!Number.isSafeInteger(v)) throw Error("Valor excede o limite de cálculo.");
    return v;
  }
  function calculate(data, players, mode, cash) {
    if (!players.length) throw Error("Adicione pelo menos um jogador.");
    const unitTotal = (rows) =>
      rows.filter((r) => !r.ignored).reduce((s, r) => s + cents(r.price) * r.count, 0);
    const loot = unitTotal(data.drops),
      money = cents(number(cash)),
      total = mode === "money" ? loot + money : mode === "items" ? loot : loot + money;
    const costs = players.map(
      (p) => unitTotal(data.supplies.filter((r) => r.player === p.name)) + cents(number(p.extra)),
    );
    const profit = total - costs.reduce((a, b) => a + b, 0);
    const base = Math.floor(profit / players.length),
      remainder = profit - base * players.length;
    const result = players.map((p, i) => ({
      name: p.name,
      cost: costs[i],
      profit: base + (i < remainder ? 1 : 0),
      target: costs[i] + base + (i < remainder ? 1 : 0),
      items: [],
      itemValue: 0,
    }));
    if (mode !== "money") {
      const grouped = new Map();
      for (const r of data.drops.filter((r) => !r.ignored)) {
        const key = JSON.stringify([r.item, cents(r.price)]);
        if (!grouped.has(key)) grouped.set(key, { item: r.item, price: cents(r.price), count: 0 });
        grouped.get(key).count += r.count;
      }
      let zeroIndex = 0;
      for (const item of [...grouped.values()].sort((a, b) => b.price - a.price)) {
        const amounts = result.map(() => 0);
        if (item.price === 0) {
          const each = Math.floor(item.count / result.length);
          amounts.fill(each);
          for (let k = 0; k < item.count % result.length; k++)
            amounts[(zeroIndex + k) % result.length]++;
          zeroIndex = (zeroIndex + (item.count % result.length)) % result.length;
        } else {
          if (item.count > 1000000)
            throw Error("Limite de 1 milhão de unidades por item para distribuir.");
          for (let k = 0; k < item.count; k++) {
            let index = 0;
            for (let j = 1; j < result.length; j++)
              if (
                result[j].target - result[j].itemValue >
                result[index].target - result[index].itemValue
              )
                index = j;
            amounts[index]++;
            result[index].itemValue += item.price;
          }
        }
        amounts.forEach((count, i) => {
          if (count) result[i].items.push({ item: item.item, count, price: item.price });
        });
      }
    }
    result.forEach((r) => (r.adjustment = r.target - r.itemValue));
    return {
      loot,
      total,
      costs: costs.reduce((a, b) => a + b, 0),
      profit,
      result,
    };
  }
  const api = { parse, calculate };
  if (typeof module !== "undefined") module.exports = api;
  root.Loot = api;
})(globalThis);

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
    if (!players.length) {
      throw Error("Adicione pelo menos um jogador.");
    }

    const unitTotal = (rows) =>
      rows.filter((r) => !r.ignored).reduce((sum, r) => sum + cents(number(r.price)) * r.count, 0);

    const loot = unitTotal(data.drops);
    const money = mode === "items" ? 0 : cents(number(cash));
    const total = loot + money;

    const costs = players.map(
      (p) => unitTotal(data.supplies.filter((r) => r.player === p.name)) + cents(number(p.extra)),
    );

    const totalCosts = costs.reduce((sum, cost) => sum + cost, 0);
    const profit = total - totalCosts;
    const base = Math.floor(profit / players.length);
    const remainder = profit - base * players.length;

    const result = players.map((p, i) => {
      const share = base + (i < remainder ? 1 : 0);

      return {
        name: p.name,
        cost: costs[i],
        profit: share,
        target: costs[i] + share,
        items: [],
        itemValue: 0,
      };
    });

    if (mode === "both" && result.some((p) => p.target < 0)) {
      throw Error(
        "Há jogadores que precisam contribuir para cobrir o prejuízo. Use o modo apenas dinheiro para realizar esse acerto.",
      );
    }

    const grouped = new Map();

    for (const row of data.drops.filter((r) => !r.ignored)) {
      const price = cents(number(row.price));
      const key = JSON.stringify([row.item, price]);

      if (!grouped.has(key)) {
        grouped.set(key, {
          item: row.item,
          price,
          count: 0,
        });
      }

      grouped.get(key).count += row.count;
    }

    const sellItems = [];
    let zeroIndex = 0;

    for (const item of [...grouped.values()].sort((a, b) => b.price - a.price)) {
      if (mode === "money") {
        if (item.count) sellItems.push({ ...item });
        continue;
      }

      const amounts = result.map(() => 0);
      let remaining = item.count;

      if (item.price === 0) {
        const each = Math.floor(item.count / result.length);
        amounts.fill(each);

        for (let k = 0; k < item.count % result.length; k++) {
          amounts[(zeroIndex + k) % result.length]++;
        }

        zeroIndex = (zeroIndex + (item.count % result.length)) % result.length;

        remaining = 0;
      } else {
        if (item.count > 1000000) {
          throw Error("Limite de 1 milhão de unidades por item para distribuir.");
        }

        while (remaining > 0) {
          let selected = -1;
          let largestGap = -Infinity;

          result.forEach((player, index) => {
            const itemTarget = mode === "both" ? Math.floor(player.target / 2) : player.target;

            const gap = itemTarget - player.itemValue;

            // No modo misto, não ultrapassar a metade em itens.
            if (mode === "both" && item.price > gap) return;

            if (gap > largestGap) {
              largestGap = gap;
              selected = index;
            }
          });

          // Nenhum jogador pode receber este item no limite de 50%.
          // As unidades restantes serão vendidas.
          if (selected === -1) break;

          amounts[selected]++;
          result[selected].itemValue += item.price;
          remaining--;
        }
      }

      amounts.forEach((count, index) => {
        if (count > 0) {
          result[index].items.push({
            item: item.item,
            count,
            price: item.price,
          });
        }
      });

      if (remaining > 0) {
        sellItems.push({
          item: item.item,
          count: remaining,
          price: item.price,
        });
      }
    }

    result.forEach((player) => {
      player.adjustment = player.target - player.itemValue;
    });

    const saleValue = sellItems.reduce((sum, item) => sum + item.count * item.price, 0);

    return {
      loot,
      total,
      costs: totalCosts,
      profit,
      result,
      sellItems,
      saleValue,
      availableCash: money + saleValue,
    };
  }
  const api = { parse, calculate };
  if (typeof module !== "undefined") module.exports = api;
  root.Loot = api;
})(globalThis);

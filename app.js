"use strict";
const $ = (id) => document.getElementById(id);
let data = { drops: [], supplies: [] },
  players = [],
  report = "";
const fmt = (c) =>
  (c / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
function el(tag, text) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
}
function invalidate() {
  $("result").hidden = true;
  $("error").textContent = "";
}
function playerUI() {
  $("players").replaceChildren();
  players.forEach((p, i) => {
    const row = el("div");
    row.className = "player";
    row.append(el("span", p.name));
    const label = el("label", "Gasto extra "),
      input = el("input");
    input.type = "number";
    input.min = 0;
    input.step = ".01";
    input.value = p.extra;
    input.oninput = () => {
      p.extra = input.value;
      invalidate();
    };
    label.append(input);
    const remove = el("button", "Remover");
    remove.onclick = () => {
      if ([...data.drops, ...data.supplies].some((r) => r.player === p.name)) {
        $("error").textContent =
          "Este jogador possui registros no arquivo e deve participar da divisão.";
        return;
      }
      players.splice(i, 1);
      playerUI();
      invalidate();
    };
    row.append(label, remove);
    $("players").append(row);
  });
}
function rowsUI() {
  $("rows").replaceChildren();

  for (const [key, title] of [
    ["drops", "Loot"],
    ["supplies", "Suprimentos"],
  ]) {
    $("rows").append(el("h3", title));

    const grid = el("div");
    grid.className = "player-items-grid";

    for (const player of players) {
      const panel = el("section");
      panel.className = "player-items-panel";

      const records = data[key].filter((r) => r.player === player.name && !r.ignored);

      const heading = el("div");
      heading.className = "player-items-heading";
      heading.append(el("h4", player.name), el("span", `${records.length} registro(s)`));
      panel.append(heading);

      if (!records.length) {
        panel.append(el("p", "Nenhum registro para este jogador."));
        grid.append(panel);
        continue;
      }

      const wrap = el("div");
      wrap.className = "scroll";

      const table = el("table");
      const thead = el("thead");
      const head = el("tr");

      ["Item", "Qtd.", "Preço un."].forEach((title) => {
        const th = el("th", title);
        th.scope = "col";
        head.append(th);
      });

      thead.append(head);
      table.append(thead);

      const tbody = el("tbody");

      for (const r of records) {
        const tr = el("tr");
        tr.append(el("td", r.item), el("td", r.count));

        const price = el("input");
        price.type = "number";
        price.min = "0";
        price.step = "0.01";
        price.value = r.price;
        price.setAttribute("aria-label", `Preço de ${r.item} de ${r.player}`);

        price.oninput = () => {
          r.price = price.value;
          invalidate();
        };

        const priceCell = el("td");
        priceCell.append(price);
        tr.append(priceCell);

        tbody.append(tr);
      }

      table.append(tbody);
      wrap.append(table);
      panel.append(wrap);
      grid.append(panel);
    }

    $("rows").append(grid);
  }
}
function importText(text, source) {
  try {
    if (!text.trim()) {
      throw new Error("Cole o texto da caçada antes de importar.");
    }

    const parsed = Loot.parse(text);

    data = parsed;

    players = [...new Set([...data.drops, ...data.supplies].map((r) => r.player))].map((name) => ({
      name,
      extra: 0,
    }));

    playerUI();
    rowsUI();
    invalidate();

    $("status").textContent =
      source +
      " • " +
      players.length +
      " jogador(es). Confira os preços zerados antes de calcular.";
  } catch (e) {
    $("error").textContent = e.message;
    $("status").textContent = "Importação falhou. Os dados anteriores foram mantidos.";
  }
}

$("file").onchange = async () => {
  const file = $("file").files[0];

  if (!file) return;

  try {
    const text = await file.text();
    importText(text, file.name);
  } catch (e) {
    $("error").textContent = "Não foi possível ler o arquivo. Tente novamente.";
  }

  $("file").value = "";
};

$("import-text").onclick = () => {
  importText($("paste").value, "Texto colado");
};
$("add").onsubmit = (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  if (!name) return;
  if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    $("error").textContent = "Jogador já adicionado.";
    return;
  }
  players.push({ name, extra: 0 });
  $("name").value = "";
  playerUI();
  invalidate();
};
$("mode").onchange = $("cash").oninput = invalidate;
$("calc").onclick = () => {
  invalidate();
  try {
    const mode = $("mode").value,
      r = Loot.calculate(data, players, mode, $("cash").value);
    $("summary").replaceChildren();
    const cards = el("div");
    cards.className = "cards";
    for (const [title, value] of [
      ["Valor a dividir", r.total],
      ["Gastos do grupo", r.costs],
      ["Lucro / prejuízo", r.profit],
    ]) {
      const card = el("div", title);
      card.append(el("strong", fmt(value)));
      cards.append(card);
    }
    $("summary").append(cards);
    if (r.profit < 0)
      $("summary").append(
        el(
          "p",
          "O loot não cobre os gastos. O prejuízo foi dividido igualmente. Valores negativos indicam que o jogador precisa contribuir para o acerto.",
        ),
      );
    $("output").replaceChildren();
    report =
      "PXG — divisão da caçada\nModo: " +
      $("mode").selectedOptions[0].text +
      "\nTotal: " +
      fmt(r.total) +
      "\nGastos: " +
      fmt(r.costs) +
      "\nLucro/prejuízo: " +
      fmt(r.profit) +
      "\n";
    for (const p of r.result) {
      const card = el("article");
      card.className = "result-player";

      card.append(el("h3", p.name));

      const stats = el("div");
      stats.className = "result-stats";

      for (const [label, value] of [
        ["Gasto individual", p.cost],
        ["Lucro / prejuízo", p.profit],
        ["Direito total", p.target],
      ]) {
        const stat = el("div");
        stat.append(el("span", label), el("strong", fmt(value)));
        stats.append(stat);
      }

      if (mode !== "items") {
        card.append(stats);
      }

      report +=
        "\n" +
        p.name +
        "\nGasto: " +
        fmt(p.cost) +
        " | Lucro/prejuízo: " +
        fmt(p.profit) +
        " | Direito total: " +
        fmt(p.target) +
        "\n";

      if (mode !== "money") {
        card.append(el("h4", "Itens para receber"));

        if (p.items.length) {
          const wrap = el("div");
          wrap.className = "result-items";

          const table = el("table");
          const thead = el("thead");
          const head = el("tr");

          ["Item", "Qtd.", "Valor total"].forEach((title) => {
            const th = el("th", title);
            th.scope = "col";
            head.append(th);
          });

          thead.append(head);
          table.append(thead);

          const tbody = el("tbody");

          for (const item of p.items) {
            const value = item.count * item.price;
            const row = el("tr");

            row.append(el("td", item.item), el("td", item.count), el("td", fmt(value)));

            tbody.append(row);

            report += item.count + " × " + item.item + " (valor: " + fmt(value) + ")\n";
          }

          table.append(tbody);
          wrap.append(table);
          card.append(wrap);

          const subtotal = el("div");
          subtotal.className = "result-subtotal";
          subtotal.append(el("span", "Valor dos itens recebidos"), el("strong", fmt(p.itemValue)));
          card.append(subtotal);
        } else {
          card.append(el("p", "Nenhum item destinado a este jogador."));
        }
      }

      if (mode === "items") {
        const difference = el("div");
        difference.className = "result-subtotal";

        const label =
          p.adjustment > 0
            ? "Valor que faltou receber em itens"
            : p.adjustment < 0
              ? "Valor recebido a mais em itens"
              : "Divisão exata em itens";

        difference.append(el("span", label), el("strong", fmt(Math.abs(p.adjustment))));

        card.append(difference);
        $("output").append(card);

        report += label + ": " + fmt(Math.abs(p.adjustment)) + "\n";

        continue;
      }

      const mustPay = p.adjustment < 0;

      const adjustmentLabel =
        mode === "money"
          ? mustPay
            ? "Contribuir em dinheiro"
            : "Receber em dinheiro"
          : p.adjustment === 0
            ? "Sem ajuste em dinheiro"
            : mustPay
              ? "Pagar ajuste em dinheiro"
              : "Receber ajuste em dinheiro";

      const payment = el("div");
      payment.className = mustPay ? "result-payment is-negative" : "result-payment";

      payment.append(el("span", adjustmentLabel), el("strong", fmt(Math.abs(p.adjustment))));

      card.append(payment);
      $("output").append(card);

      report += adjustmentLabel + ": " + fmt(Math.abs(p.adjustment)) + "\n";
    }
    if (mode !== "money")
      $("output").append(
        el(
          "p",
          "Reúna os itens do grupo antes de distribuir. Itens indivisíveis podem gerar diferenças entre o valor recebido e o direito de cada jogador. No modo apenas itens, essas diferenças são informativas e não geram pagamento em dinheiro.",
        ),
      );

    if (mode === "both") {
      const sales = el("article");
      sales.className = "result-player sales-card";
      sales.append(el("h3", "Itens do grupo para vender"));

      report += "\nITENS DO GRUPO PARA VENDER\n";

      if (r.sellItems.length) {
        const wrap = el("div");
        wrap.className = "result-items";

        const table = el("table");
        const thead = el("thead");
        const header = el("tr");

        ["Item", "Qtd.", "Valor de venda"].forEach((title) => {
          const th = el("th", title);
          th.scope = "col";
          header.append(th);
        });

        thead.append(header);
        table.append(thead);

        const tbody = el("tbody");

        for (const item of r.sellItems) {
          const value = item.count * item.price;
          const row = el("tr");

          row.append(el("td", item.item), el("td", item.count), el("td", fmt(value)));

          tbody.append(row);
          report += `${item.count} × ${item.item}: ${fmt(value)}\n`;
        }

        table.append(tbody);
        wrap.append(table);
        sales.append(wrap);
      } else {
        sales.append(el("p", "Não é necessário vender itens."));
      }

      const subtotal = el("div");
      subtotal.className = "result-subtotal";
      subtotal.append(
        el("span", "Dinheiro das vendas + dinheiro adicional"),
        el("strong", fmt(r.availableCash)),
      );

      sales.append(subtotal);

      sales.append(
        el(
          "p",
          "Venda somente os itens desta lista. Os itens destinados aos jogadores já estão separados. A venda considera os preços unitários informados.",
        ),
      );

      $("output").append(sales);

      report += "Dinheiro disponível após as vendas: " + fmt(r.availableCash) + "\n";
    }
    $("result").hidden = false;
  } catch (e) {
    $("error").textContent = e.message;
  }
};
$("download").onclick = () => {
  const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
  const a = el("a");
  a.href = url;
  a.download = "divisao-pxg.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

import { commonDirectiveOptions, listTableDirective } from "myst-directives";
import { select, selectAll } from "unist-util-select";

const estimateTableDirective = {
  ...listTableDirective,
  name: "estimate-table",
  doc: "A directive for easily defining summary estimates.",

  options: {
    ...listTableDirective.options,
    ...commonDirectiveOptions("estimate-table"),
  },
  run(data, vfile) {
    // Find the table node
    const [containerNode] = listTableDirective.run(data, vfile);
    const tableNode = select("table", containerNode);

    // Consider non-header rows
    let hasHeader = false;
    const allRows = selectAll("tableRow", tableNode);
    for (const rowNode of allRows) {
      const rowIsHeader = selectAll("tableCell", rowNode).some(
        (cellNode) => !!cellNode.header,
      );
      if (rowIsHeader) {
        hasHeader = true;
        break;
      }
    }
    const contributingRows = allRows.slice(hasHeader ? 1 : 0);
    // Compute the min and max hours from the 2nd and 3rd columns
    let minHours = 0;
    let maxHours = 0;
    contributingRows.forEach((row) => {
      let match;
      let minText = "0";
      const rawMinText = select("tableCell:nth-child(2) text", row);
      if ((match = rawMinText.value.match(/^(\d+)h$/))) {
        minText = match[1];
      }
      // Default to min = max
      let maxText = minText;
      const rawMaxText = select("tableCell:nth-child(3) text", row);
      if ((match = rawMaxText.value.match(/^(\d+)h$/))) {
        maxText = match[1];
      }

      minHours += Number.parseInt(minText);
      maxHours += Number.parseInt(maxText);
    });

    // Add the header
    tableNode.children.unshift({
      type: "tableRow",
      children: [
        {
          type: "tableCell",
          header: true,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value: "Task",
                },
              ],
            },
          ],
        },
        {
          type: "tableCell",
          header: true,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value: "Lower Estimate",
                },
              ],
            },
          ],
        },
        {
          type: "tableCell",
          header: true,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value: "Upper Estimate",
                },
              ],
            },
          ],
        },
      ],
    });
    tableNode.children.push({
      type: "tableRow",
      children: [
        {
          type: "tableCell",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "strong",
                  children: [
                    {
                      type: "text",
                      value: "Total",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "tableCell",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "strong",
                  children: [
                    {
                      type: "text",
                      value: `${minHours}h`,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "tableCell",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "strong",
                  children: [
                    {
                      type: "text",
                      value: `${maxHours}h`,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    return [containerNode];
  },
};

const plugin = {
  name: "Compute table estimates",
  directives: [estimateTableDirective],
};

export default plugin;

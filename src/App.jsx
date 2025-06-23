import { useEffect, useState } from "react";
import mondaySdk from "monday-sdk-js";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import "./App.css";

function App() {
  const monday = mondaySdk();
  const [subItems, setSubItems] = useState([]);
  const [subItemColumnData, setSubItemColumnData] = useState([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [boardId, setBoardId] = useState(null);

  const getAllItems = async (boardId) => {
    try {
      // Get total item count first
      const getItemsCount = await monday.api(`query {
        boards (ids: [${boardId}]) {
          items_count
        }
      }`);

      console.log("Total items:", getItemsCount.data.boards[0].items_count);

      let allItems = [];
      let cursor = null;
      let hasMoreItems = true;

      while (hasMoreItems) {
        let query;

        if (cursor === null) {
          // First page query
          query = `query {
            complexity {
              before
              after
              query
            }
            boards (ids: [${boardId}]) {
              items_count
              items_page (limit: 500) {
                cursor
                items {
                  name
                  id
                  subitems {
                    board {
                      id
                    }
                    name
                    id
                    column_values {
                      column {
                        title
                      }
                      value
                      id
                      type
                    }
                  }
                }
              }
            }
          }`;
        } else {
          // Subsequent pages query
          query = `query {
            complexity {
              before
              after
              query
            }
            boards (ids: [${boardId}]) {
              items_count
              items_page (limit: 500, cursor: "${cursor}") {
                cursor
                items {
                  name
                  id
                  subitems {
                    board {
                      id
                    }
                    name
                    id
                    column_values {
                      column {
                        title
                      }
                      value
                      id
                      type
                    }
                  }
                }
              }
            }
          }`;
        }

        const response = await monday.api(query);
        const itemsPage = response.data.boards[0].items_page;

        // Add items to our collection
        allItems = [...allItems, ...itemsPage.items];

        // Update cursor for next iteration
        cursor = itemsPage.cursor;

        // If cursor is null, we've reached the end
        if (cursor === null) {
          hasMoreItems = false;
        }

        console.log(
          `Fetched ${itemsPage.items.length} items, cursor: ${cursor}`
        );
      }

      console.log(`Total items fetched: ${allItems.length}`);
      console.log(allItems);
      // Store all items in state

      // only store subitems
      const subItems = allItems.map((item) => item.subitems);

      setSubItems(subItems);

      return allItems;
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const generateNewTimestamp = () => {
    const now = new Date();
    return now.toISOString();
  };

  const duplicateCreationLogs = async () => {
    if (!targetColumnId || !boardId) {
      alert("Please select a target column first");
      return;
    }

    setLoading(true);
    setSuccess(false);
    setProgress({ processed: 0, total: 0 });

    try {
      // Collect all subitems with creation log columns
      const itemsToUpdate = [];

      subItems.forEach((subItemGroup) => {
        if (subItemGroup && subItemGroup.length > 0) {
          subItemGroup.forEach((subItem) => {
            if (subItem && subItem.column_values) {
              // Find creation log column
              const creationLogColumn = subItem.column_values.find(
                (col) => col.type === "creation_log"
              );

              if (creationLogColumn && creationLogColumn.value) {
                try {
                  itemsToUpdate.push({
                    itemId: subItem.id,
                    columnId: targetColumnId,
                    value: creationLogColumn.value,
                    boardId: subItem.board.id,
                  });
                } catch (e) {
                  console.warn(
                    "Failed to parse creation log for subitem:",
                    subItem.id,
                    e
                  );
                }
              }
            }
          });
        }
      });

      console.log(`Found ${itemsToUpdate.length} items to update`);
      setProgress({ processed: 0, total: itemsToUpdate.length });

      // Group into batches of 80
      const batchSize = 80;
      const batches = [];

      for (let i = 0; i < itemsToUpdate.length; i += batchSize) {
        batches.push(itemsToUpdate.slice(i, i + batchSize));
      }

      console.log(`Processing ${batches.length} batches`);

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        // Build mutation for this batch
        const mutations = batch
          .map(
            (item, index) =>
              `update_${batchIndex}_${index}: change_simple_column_value(item_id: ${item.itemId}, board_id: ${item.boardId}, column_id: "${item.columnId}", value: "${item.value}") {
            id
          }`
          )
          .join("\n\n");

        console.log(mutations);

        const fullMutation = `mutation {
          ${mutations}
        }`;

        try {
          console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
          const response = await monday.api(fullMutation);
          console.log(`Batch ${batchIndex + 1} completed:`, response);

          // Update progress
          setProgress((prev) => ({
            ...prev,
            processed: prev.processed + batch.length,
          }));
        } catch (error) {
          console.error(`Error processing batch ${batchIndex + 1}:`, error);
          // Continue with next batch even if one fails
        }

        // Add 5-second delay between batches (except for the last batch)
        if (batchIndex < batches.length - 1) {
          console.log("Waiting 5 seconds before next batch...");
          await sleep(5000);
        }
      }

      setSuccess(true);
      console.log("All batches processed successfully");
    } catch (error) {
      console.error("Error during duplication:", error);
      alert("An error occurred during duplication. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchContext = async () => {
      const context = await monday.get("context");
      console.log(context);
      setBoardId(context.data.boardId);
      getAllItems(context.data.boardId);
      console.log(subItems);
      console.log(subItemColumnData);
    };
    fetchContext();
  }, []);

  // a dropdown that is used to select the subitem target column by name and id
  const [targetColumnId, setTargetColumnId] = useState("");

  // Get available columns from the first subitem
  const getAvailableColumns = () => {
    if (subItems.length > 0 && subItems[0].length > 0) {
      // Get the first subitem from the first item
      const firstSubItem = subItems[0][0];
      if (firstSubItem && firstSubItem.column_values) {
        return firstSubItem.column_values.map((columnValue) => ({
          id: columnValue.id,
          title: columnValue.column.title,
        }));
      }
    }
    return [];
  };

  const handleColumnChange = (event) => {
    setTargetColumnId(event.target.value);
  };

  const availableColumns = getAvailableColumns();

  return (
    <>
      <h1>Creation Log Duplicator</h1>
      {subItems.length > 0 && (
        <p>
          Found {subItems.length} subitems. Select a target column to duplicate
          the creation log.
        </p>
      )}
      <Box sx={{ minWidth: 120, margin: 2 }}>
        <FormControl fullWidth>
          <InputLabel id="column-select-label">Select Target Column</InputLabel>
          <Select
            labelId="column-select-label"
            id="column-select"
            value={targetColumnId}
            label="Select Target Column"
            onChange={handleColumnChange}
          >
            {availableColumns.map((column) => (
              <MenuItem key={column.id} value={column.id}>
                {column.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {targetColumnId && <p>Selected column ID: {targetColumnId}</p>}

      <Box sx={{ margin: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={duplicateCreationLogs}
          disabled={loading || !targetColumnId}
        >
          {loading ? <CircularProgress size={24} /> : "Duplicate Creation Logs"}
        </Button>
      </Box>

      {loading && (
        <Box sx={{ margin: 2 }}>
          <Typography variant="body2">
            Processing: {progress.processed} / {progress.total} items
          </Typography>
        </Box>
      )}

      {success && (
        <Box sx={{ margin: 2 }}>
          <Typography variant="body1" color="success.main">
            Successfully updated {progress.total} creation log timestamps!
          </Typography>
        </Box>
      )}
    </>
  );
}

export default App;

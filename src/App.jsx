import { useEffect, useState } from "react";
import mondaySdk from "monday-sdk-js";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import "./App.css";

function App() {
  const monday = mondaySdk();
  const [subItems, setSubItems] = useState([]);
  const [subItemColumnData, setSubItemColumnData] = useState([]);
  const [success, setSuccess] = useState(false);

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

  useEffect(() => {
    const fetchContext = async () => {
      const context = await monday.get("context");
      console.log(context);
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

      <Button variant="contained" color="primary">
        Duplicate
      </Button>

      {success && <p>Successfully duplicated</p>}
    </>
  );
}

export default App;

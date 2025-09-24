import { Plugin } from "kettu";
import { showToast } from "@kettu/utils";
import { sendMessage } from "@kettu/api/messages";
import { Clipboard } from "react-native";

export default class ImageToGifPlugin extends Plugin {
  start() {
    this.patcher.after("MessageAttachmentContextMenu", "default", (_, [props], ret) => {
      const image = props?.attachment;
      if (!image || !image.content_type?.startsWith("image/")) return;

      const convertAndGetGif = async () => {
        try {
          showToast("Uploading to CloudConvert...");

          const apiKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMTgzZDM0YjVhNjczMWE5MmVhNzExZWZkNzEyMzI2ZWIyNzAxNGYxYWVmNTAwYzk3N2I4YjFkODRmNmY5ZTBlMjc4NzM0MWFlOGEwNTJkYTUiLCJpYXQiOjE3NTg2NzgyNjUuMjQyOTMsIm5iZiI6MTc1ODY3ODI2NS4yNDI5MzEsImV4cCI6NDkxNDM1MTg2NS4yMzc1Miwic3ViIjoiNzI5OTc5MDEiLCJzY29wZXMiOltdfQ.UtqKFVfyv_Pe0pZDS3yFS9fJWuUAEjgYS44MYvd-5_c21WRugAuiwf1Aj_1V-RfdlvKQJrOBCnHBxq_FXXlwk3aZ8iSg5C0fVVZoXmbX68wB6EXxLFB622md2rajprpNjo-7lBU9EVUS5Lz6NLsvMBCd654iFQwcol3oy0-00ztUzejcWzBo_3ssbts0d67tgQ0FoeGO-xU23s4YJy3a36e34g6SphjuAptc9okxacpy4g17MWuX3Tyi-Rb3lb1e865mLz4q-r1k_DsMKyyjPXbBm64w2wh9t17_wvCzDDAjW6Lni9a1I8Qj0fLXgUamoIoA8JZ8xDWUlmZyccimO6P2CADIsQAA0OW47-NdqWUhfLhJMfivWL_uSCi9bnhVoVtzC_ht9Tpqm64F8fx3TERyr_Hn4QjgbolMOYPZGZ2GxvyonPqothLi8EvHnwhMStk6g6KsvtoKY7hEqwE5lRsrCRHjd1D-rKJK-bP53jNMbZLD6Y3ShRKuqRne5DAUHd1gTxx8l19b4jNcknQNSDcavNUPsGqfEDxRxF5YY0FBQPpFtO46aH3Z8IxY4C4IcC7nQXWQUbXek4QDvM1Q0fx3aNC0GoT5SOlUxS82-d71irD-yDMxBRdOCOwUZg3ZZ6p4mUdBjBEKUhzplDwE7KlHeAWfe81jxBlVxmWOlJk"; // 🔑 replace this

          // Create job (import → convert → export)
          const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              tasks: {
                import: { operation: "import/url", url: image.url },
                convert: { operation: "convert", input: "import", output_format: "gif" },
                export: { operation: "export/url", input: "convert" }
              }
            })
          });
          const job = await jobRes.json();

          showToast("Converting image...");

          // Poll until export task is done
          let gifUrl = null;
          while (!gifUrl) {
            const checkRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${job.data.id}`, {
              headers: { "Authorization": `Bearer ${apiKey}` }
            });
            const jobStatus = await checkRes.json();

            const exportTask = jobStatus.data.tasks.find(
              t => t.operation === "export/url" && t.result?.files?.length
            );

            if (exportTask) {
              gifUrl = exportTask.result.files[0].url;
            } else {
              await new Promise(r => setTimeout(r, 2000));
            }
          }

          return gifUrl;
        } catch (err) {
          console.error(err);
          showToast("❌ Conversion failed");
          return null;
        }
      };

      // Button: Convert & Send
      ret.props.children.push({
        type: "button",
        label: "Convert to GIF & Send",
        onPress: async () => {
          const gifUrl = await convertAndGetGif();
          if (!gifUrl) return;

          if (props.message?.channel_id) {
            await sendMessage(props.message.channel_id, {
              content: "",
              attachments: [gifUrl]
            });
            showToast("✅ GIF sent!");
          } else {
            showToast("❌ Could not detect channel");
          }
        }
      });

      // Button: Convert & Copy
      ret.props.children.push({
        type: "button",
        label: "Convert to GIF & Copy Link",
        onPress: async () => {
          const gifUrl = await convertAndGetGif();
          if (!gifUrl) return;

          Clipboard.setString(gifUrl);
          showToast("📋 GIF link copied to clipboard!");
        }
      });
    });

    console.log("✅ ImageToGifPlugin started (send + copy modes)");
  }

  stop() {
    this.patcher.unpatchAll();
    console.log("🛑 ImageToGifPlugin stopped");
  }
}
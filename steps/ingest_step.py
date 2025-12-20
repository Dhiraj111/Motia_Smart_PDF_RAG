import os
import time
import logging

# Motia config
config = {
    "name": "ProcessPDF",
    "type": "event",
    "subscribes": ["file.uploaded"],
    "emits": []
}

async def handler(event, context):
    logger = context.logger
    print("\n\n🔥 PYTHON WORKER RECEIVED EVENT 🔥")
    
    # 1. DEBUG: Print the raw event structure to understand what we got
    print(f"   -> Raw Event Type: {type(event)}")
    print(f"   -> Raw Event Content: {event}")

    try:
        # 2. Dynamic Data Extraction
        # Sometimes Motia passes { data: { filePath... } } and sometimes just { filePath... }
        if "data" in event:
            data = event["data"]
            print("   -> Extracted 'data' key.")
        else:
            # Assume the event IS the data
            data = event
            print("   -> Using event as data payload directly.")

        # 3. Import dependencies safely
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        from pinecone import Pinecone
        from langchain_community.document_loaders import PyPDFLoader
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain_huggingface import HuggingFaceEmbeddings

        # 4. Extract Variables
        file_path = data.get("filePath")
        file_id = data.get("fileId")

        if not file_path:
            logger.error(f"❌ Missing 'filePath' in event! Keys found: {list(data.keys())}")
            return
        
        if not os.path.exists(file_path):
            logger.error(f"❌ File not found: {file_path}")
            return

        logger.info(f"Processing PDF: {file_path}")

        # 5. Process PDF
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        logger.info(f"Loaded {len(documents)} pages")

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = text_splitter.split_documents(documents)

        # 6. Embed & Upload
        # Check for API Keys
        api_key = os.getenv("PINECONE_API_KEY")
        index_name = os.getenv("PINECONE_INDEX")
        
        if not api_key or not index_name:
            logger.error("❌ Missing PINECONE_API_KEY or PINECONE_INDEX in .env")
            return

        hf = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        pc = Pinecone(api_key=api_key)
        index = pc.Index(index_name)

        vectors = []
        for i, chunk in enumerate(chunks):
            embedding = hf.embed_query(chunk.page_content)
            vectors.append({
                "id": f"{file_id}_{i}",
                "values": embedding,
                "metadata": {
                    "text": chunk.page_content,
                    "file_id": file_id,
                    "page": chunk.metadata.get("page", 0)
                }
            })

        # Batch Upload
        batch_size = 50
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            index.upsert(vectors=batch)

        logger.info("✅ PDF Successfully Indexed!")

    except Exception as e:
        logger.error(f"❌ Worker Error: {str(e)}")
        import traceback
        traceback.print_exc()
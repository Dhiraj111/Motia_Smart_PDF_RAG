import os
import logging
from dotenv import load_dotenv

# 1. Load .env explicitly (Fixes missing keys)
load_dotenv()

# 2. Disable Progress Bars (Prevents Mac crashes)
os.environ["TQDM_DISABLE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
logging.getLogger("transformers").setLevel(logging.ERROR)

config = {
    "name": "ProcessPDF",
    "type": "event",
    "subscribes": ["file.uploaded"]
}

async def handler(event, context):
    logger = context.logger
    print("\n\n🔥 PYTHON WORKER: EVENT RECEIVED! 🔥\n")
    
    try:
        # 3. Import Libraries (Lazy load)
        print("   -> Importing libraries...")
        from pinecone import Pinecone
        from langchain_community.document_loaders import PyPDFLoader
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain_huggingface import HuggingFaceEmbeddings

        # 4. Check Keys
        api_key = os.getenv("PINECONE_API_KEY")
        index_name = os.getenv("PINECONE_INDEX")
        if not api_key:
            logger.error("❌ ERROR: PINECONE_API_KEY is missing from env!")
            return

        # 5. Process Data
        data = event["data"]
        file_path = data["filePath"]
        file_id = data["fileId"]
        
        print(f"   -> Checking file: {file_path}")
        if not os.path.exists(file_path):
            logger.error(f"❌ ERROR: File does not exist at path: {file_path}")
            # Try to list the directory to see what IS there
            directory = os.path.dirname(file_path)
            print(f"      Contents of {directory}: {os.listdir(directory)}")
            return

        print("   -> Parsing PDF...")
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        
        print(f"   -> Split {len(documents)} pages. generating embeddings...")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = text_splitter.split_documents(documents)
        
        # 6. Generate Embeddings
        hf = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
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

        # 7. Upload
        print(f"   -> Uploading {len(vectors)} vectors to Pinecone index '{index_name}'...")
        pc = Pinecone(api_key=api_key)
        index = pc.Index(index_name)
        
        batch_size = 50
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            index.upsert(vectors=batch)

        print("\n✅ SUCCESS: PDF Indexed successfully!\n")

    except Exception as e:
        print(f"\n❌ PYTHON CRASH: {str(e)}\n")
        import traceback
        traceback.print_exc()